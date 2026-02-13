// Brickout - a Breakout clone for Quinix
//
// Run with:
//   bun run bin/qrun.ts examples/lowlevel/brickout.qll -- --display 320x200 --keyboard

.constant global CLOCK_BASE: byte = 0x301;
.constant global DISPLAY_BASE: byte = 0x603;
.constant global KEYBOARD_BASE: byte = 0x607;
.constant global FB_ADDR: byte = 0x10000;

.constant global SCREEN_W: byte = 320;
.constant global SCREEN_H: byte = 200;

// Brick grid
.constant global BRICK_COLS: byte = 10;
.constant global BRICK_ROWS: byte = 5;
.constant global BRICK_W: byte = 30;
.constant global BRICK_H: byte = 10;
.constant global BRICK_GAP: byte = 2;
.constant global BRICK_STRIDE_X: byte = 32;  // BRICK_W + BRICK_GAP
.constant global BRICK_STRIDE_Y: byte = 12;  // BRICK_H + BRICK_GAP
.constant global BRICK_AREA_X: byte = 0;
.constant global BRICK_AREA_Y: byte = 24;
.constant global BRICK_COUNT: byte = 50;     // BRICK_COLS * BRICK_ROWS

// Paddle
.constant global PADDLE_W: byte = 48;
.constant global PADDLE_H: byte = 6;
.constant global PADDLE_Y: byte = 188;
.constant global PADDLE_SPEED: byte = 4;

// Ball
.constant global BALL_R: byte = 3;
.constant global BALL_SPEED: byte = 2;

// Game state
.constant global STATE_PLAYING: byte = 0;
.constant global STATE_DEAD: byte = 1;
.constant global STATE_WIN: byte = 2;
.constant global STATE_LAUNCH: byte = 3;

// Row colors
global ROW_COLORS: byte[5] = [
  0xFFFF0000,  // Red
  0xFFFF8800,  // Orange
  0xFFFFFF00,  // Yellow
  0xFF00FF00,  // Green
  0xFF00AAFF,  // Light blue
];

function itoa(n: byte, buf: byte[]): void {
  var i: byte = 0;
  var tmp: byte[6];

  if (n == 0) {
    buf[0] = '0';
    buf[1] = 0;
    return;
  }

  while (n > 0 && i < 6) {
    tmp[i] = '0' + (n % 10);
    n = n / 10;
    i = i + 1;
  }

  var j: byte = 0;
  while (i > 0) {
    i = i - 1;
    buf[j] = tmp[i];
    j = j + 1;
  }
  buf[j] = 0;
}

function abs(x: byte): byte {
  // Values > 0x7FFFFFFF are "negative" in two's complement
  if (x > 0x7FFFFFFF) {
    return 0 - x;
  }
  return x;
}

// Check if a value represents a positive signed number
function is_positive(x: byte): bool {
  return x > 0 && x < 0x80000000;
}

function draw_bricks(fb: *graphics::framebuffer, bricks: byte[]): void {
  for (var row: byte = 0; row < BRICK_ROWS; row = row + 1) {
    for (var col: byte = 0; col < BRICK_COLS; col = col + 1) {
      var idx = row * BRICK_COLS + col;
      var bx = BRICK_AREA_X + col * BRICK_STRIDE_X;
      var by = BRICK_AREA_Y + row * BRICK_STRIDE_Y;
      if (bricks[idx]) {
        graphics::fill_rect(fb, bx, by, BRICK_W, BRICK_H, ROW_COLORS[unsafe row]);
      } else {
        graphics::fill_rect(fb, bx, by, BRICK_W, BRICK_H, graphics::color::BLACK);
      }
    }
  }
}

function draw_paddle(fb: *graphics::framebuffer, px: byte): void {
  graphics::fill_rect(fb, px, PADDLE_Y, PADDLE_W, PADDLE_H, graphics::color::WHITE);
}

function draw_ball(fb: *graphics::framebuffer, bx: byte, by: byte): void {
  graphics::fill_circle(fb, bx, by, BALL_R, graphics::color::WHITE);
}

function draw_hud(fb: *graphics::framebuffer, score: byte, lives: byte): void {
  var buf: byte[8];

  // Score
  graphics::fill_rect(fb, 0, 0, 160, 10, graphics::color::BLACK);
  graphics::font::draw_string(fb, 4, 1, "SCORE:", graphics::color::GRAY, graphics::color::BLACK);
  itoa(score, buf);
  graphics::font::draw_string(fb, 52, 1, buf, graphics::color::WHITE, graphics::color::BLACK);

  // Lives
  graphics::font::draw_string(fb, 100, 1, "LIVES:", graphics::color::GRAY, graphics::color::BLACK);
  itoa(lives, buf);
  graphics::font::draw_string(fb, 148, 1, buf, graphics::color::WHITE, graphics::color::BLACK);
}

function main(): byte {
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);
  var kb = keyboard::init(KEYBOARD_BASE);

  // Brick state: 1 = alive, 0 = destroyed
  var bricks: byte[50];

  // Game variables
  var score: byte = 0;
  var lives: byte = 3;
  var bricks_left: byte = 0;
  var state: byte = STATE_LAUNCH;

  // Paddle position (left edge x)
  var px: byte = (SCREEN_W - PADDLE_W) / 2;

  // Ball position and velocity
  var bx: byte = 0;
  var by: byte = 0;
  var bdx: byte = BALL_SPEED;
  var bdy: byte = 0 - BALL_SPEED;

  // Frame timing
  var clock = <unsafe *byte>CLOCK_BASE;
  var last_time: byte = *clock;
  var frame_ms: byte = 16;  // ~60fps target

  // Initialize bricks
  for (var i: byte = 0; i < BRICK_COUNT; i = i + 1) {
    bricks[i] = 1;
  }
  bricks_left = BRICK_COUNT;

  // Initial draw
  graphics::clear(&fb, graphics::color::BLACK);
  draw_bricks(&fb, bricks);
  draw_hud(&fb, score, lives);

  // Position ball on paddle for launch
  bx = px + PADDLE_W / 2;
  by = PADDLE_Y - BALL_R - 1;

  while (true) {
    // Frame timing
    var now = *clock;
    if (now - last_time < frame_ms) {
      continue;
    }
    last_time = now;

    // Read keyboard (poll returns 0 if no new keypress)
    var key = keyboard::poll(&kb);

    // Move paddle
    var old_px = px;
    if (key == 'l' || key == 'a') {
      if (px >= PADDLE_SPEED) {
        px = px - PADDLE_SPEED;
      } else {
        px = 0;
      }
    }
    if (key == 'r' || key == 'd') {
      if (px + PADDLE_W + PADDLE_SPEED <= SCREEN_W) {
        px = px + PADDLE_SPEED;
      } else {
        px = SCREEN_W - PADDLE_W;
      }
    }

    // Erase old paddle if moved
    if (px != old_px) {
      graphics::fill_rect(&fb, old_px, PADDLE_Y, PADDLE_W, PADDLE_H, graphics::color::BLACK);
    }

    if (state == STATE_LAUNCH) {
      // Ball sits on paddle
      var old_bx = bx;
      bx = px + PADDLE_W / 2;
      by = PADDLE_Y - BALL_R - 1;

      // Erase old ball position
      if (bx != old_bx) {
        graphics::fill_circle(&fb, old_bx, by, BALL_R + 1, graphics::color::BLACK);
      }

      // Launch on space or up
      if (key == 's' || key == 'u' || key == ' ') {
        bdx = BALL_SPEED;
        bdy = 0 - BALL_SPEED;
        state = STATE_PLAYING;
      }
    }

    if (state == STATE_PLAYING) {
      // Erase old ball
      graphics::fill_circle(&fb, bx, by, BALL_R + 1, graphics::color::BLACK);

      // Move ball
      bx = bx + bdx;
      by = by + bdy;

      // Wall collisions
      if (bx <= BALL_R) {
        bx = BALL_R;
        bdx = abs(bdx);
      }
      if (bx >= SCREEN_W - BALL_R) {
        bx = SCREEN_W - BALL_R;
        bdx = 0 - abs(bdx);
      }
      if (by <= BALL_R + 12) {
        by = BALL_R + 12;
        bdy = abs(bdy);
      }

      // Ball fell below paddle
      if (by >= SCREEN_H - BALL_R) {
        lives = lives - 1;
        if (lives == 0) {
          state = STATE_DEAD;
        } else {
          state = STATE_LAUNCH;
          bx = px + PADDLE_W / 2;
          by = PADDLE_Y - BALL_R - 1;
          draw_hud(&fb, score, lives);
        }
      }

      // Paddle collision
      if (state == STATE_PLAYING) {
        if (is_positive(bdy) && by + BALL_R >= PADDLE_Y && by - BALL_R <= PADDLE_Y + PADDLE_H) {
          if (bx >= px && bx <= px + PADDLE_W) {
            by = PADDLE_Y - BALL_R;
            bdy = 0 - abs(bdy);

            // Angle based on hit position
            var hit = bx - px;
            if (hit < PADDLE_W / 3) {
              bdx = 0 - BALL_SPEED;
            } else {
              if (hit > PADDLE_W * 2 / 3) {
                bdx = BALL_SPEED;
              }
            }
          }
        }
      }

      // Brick collisions
      if (state == STATE_PLAYING) {
        for (var row: byte = 0; row < BRICK_ROWS; row = row + 1) {
          for (var col: byte = 0; col < BRICK_COLS; col = col + 1) {
            var idx = row * BRICK_COLS + col;
            if (!bricks[idx]) {
              continue;
            }
            var brick_x = BRICK_AREA_X + col * BRICK_STRIDE_X;
            var brick_y = BRICK_AREA_Y + row * BRICK_STRIDE_Y;

            // AABB collision between ball bounding box and brick
            if (bx + BALL_R > brick_x && bx - BALL_R < brick_x + BRICK_W &&
                by + BALL_R > brick_y && by - BALL_R < brick_y + BRICK_H) {
              // Destroy brick
              bricks[idx] = 0;
              bricks_left = bricks_left - 1;
              score = score + (BRICK_ROWS - row) * 10;

              // Erase brick
              graphics::fill_rect(&fb, brick_x, brick_y, BRICK_W, BRICK_H, graphics::color::BLACK);

              // Determine bounce direction
              // Check which side the ball hit
              var overlap_left = (bx + BALL_R) - brick_x;
              var overlap_right = (brick_x + BRICK_W) - (bx - BALL_R);
              var overlap_top = (by + BALL_R) - brick_y;
              var overlap_bottom = (brick_y + BRICK_H) - (by - BALL_R);

              var min_overlap = overlap_left;
              if (overlap_right < min_overlap) {
                min_overlap = overlap_right;
              }
              if (overlap_top < min_overlap) {
                min_overlap = overlap_top;
              }
              if (overlap_bottom < min_overlap) {
                min_overlap = overlap_bottom;
              }

              if (min_overlap == overlap_left || min_overlap == overlap_right) {
                bdx = 0 - bdx;
              } else {
                bdy = 0 - bdy;
              }

              draw_hud(&fb, score, lives);

              // Check win
              if (bricks_left == 0) {
                state = STATE_WIN;
              }

              // Only handle one brick collision per frame
              break;
            }
          }
          if (state == STATE_WIN) {
            break;
          }
          // Break out of outer loop too if we hit a brick
          // (check by seeing if we already broke from inner loop via score change)
        }
      }
    }

    if (state == STATE_DEAD) {
      graphics::font::draw_string(&fb, 112, 96, "GAME OVER", graphics::color::RED, graphics::color::BLACK);
      draw_ball(&fb, bx, by);
      draw_paddle(&fb, px);
      display::flip(DISPLAY_BASE);
      break;
    }

    if (state == STATE_WIN) {
      graphics::font::draw_string(&fb, 120, 96, "YOU WIN!", graphics::color::YELLOW, graphics::color::BLACK);
      draw_ball(&fb, bx, by);
      draw_paddle(&fb, px);
      display::flip(DISPLAY_BASE);
      break;
    }

    // Draw
    draw_ball(&fb, bx, by);
    draw_paddle(&fb, px);
    display::flip(DISPLAY_BASE);
  }

  // Show result for 3 seconds
  var end_time = *clock;
  while (*clock - end_time < 3000) {}

  return 0;
}
