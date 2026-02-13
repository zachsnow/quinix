// Brickout - a Breakout clone for Quinix (usermode version)
//
// Build and install to disk image, then run from kernel shell:
//   > run brickout.qbin
//
// Requires: --display 320x200 --keyboard flags on qvm

// Screen dimensions (must match --display flag)
.constant global SCREEN_W: byte = 320;
.constant global SCREEN_H: byte = 200;

// Brick grid
.constant global BRICK_COLS: byte = 10;
.constant global BRICK_ROWS: byte = 5;
.constant global BRICK_W: byte = 30;
.constant global BRICK_H: byte = 10;
.constant global BRICK_GAP: byte = 2;
.constant global BRICK_STRIDE_X: byte = 32;
.constant global BRICK_STRIDE_Y: byte = 12;
.constant global BRICK_AREA_X: byte = 0;
.constant global BRICK_AREA_Y: byte = 24;
.constant global BRICK_COUNT: byte = 50;

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
  0xFFFF0000,
  0xFFFF8800,
  0xFFFFFF00,
  0xFF00FF00,
  0xFF00AAFF,
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
  if (x > 0x7FFFFFFF) {
    return 0 - x;
  }
  return x;
}

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

  graphics::fill_rect(fb, 0, 0, 160, 10, graphics::color::BLACK);
  graphics::font::draw_string(fb, 4, 1, "SCORE:", graphics::color::GRAY, graphics::color::BLACK);
  itoa(score, buf);
  graphics::font::draw_string(fb, 52, 1, buf, graphics::color::WHITE, graphics::color::BLACK);

  graphics::font::draw_string(fb, 100, 1, "LIVES:", graphics::color::GRAY, graphics::color::BLACK);
  itoa(lives, buf);
  graphics::font::draw_string(fb, 148, 1, buf, graphics::color::WHITE, graphics::color::BLACK);
}

function main(): byte {
  // Open display via syscall — framebuffer is mapped into our address space
  var fb = display::open();
  if (!fb.pixels) {
    lib::print("error: could not open display\n");
    return 1;
  }

  var bricks: byte[50];
  var score: byte = 0;
  var lives: byte = 3;
  var bricks_left: byte = 0;
  var state: byte = STATE_LAUNCH;

  var px: byte = (SCREEN_W - PADDLE_W) / 2;
  var bx: byte = 0;
  var by: byte = 0;
  var bdx: byte = BALL_SPEED;
  var bdy: byte = 0 - BALL_SPEED;

  for (var i: byte = 0; i < BRICK_COUNT; i = i + 1) {
    bricks[i] = 1;
  }
  bricks_left = BRICK_COUNT;

  graphics::clear(&fb, graphics::color::BLACK);
  draw_bricks(&fb, bricks);
  draw_hud(&fb, score, lives);

  bx = px + PADDLE_W / 2;
  by = PADDLE_Y - BALL_R - 1;

  while (true) {
    // Read keyboard state via syscall
    var keys = keyboard::read();

    // Move paddle
    var old_px = px;
    if (keys & keyboard::KEY_LEFT) {
      if (px >= PADDLE_SPEED) {
        px = px - PADDLE_SPEED;
      } else {
        px = 0;
      }
    }
    if (keys & keyboard::KEY_RIGHT) {
      if (px + PADDLE_W + PADDLE_SPEED <= SCREEN_W) {
        px = px + PADDLE_SPEED;
      } else {
        px = SCREEN_W - PADDLE_W;
      }
    }

    if (px != old_px) {
      graphics::fill_rect(&fb, old_px, PADDLE_Y, PADDLE_W, PADDLE_H, graphics::color::BLACK);
    }

    if (state == STATE_LAUNCH) {
      var old_bx = bx;
      bx = px + PADDLE_W / 2;
      by = PADDLE_Y - BALL_R - 1;

      if (bx != old_bx) {
        graphics::fill_circle(&fb, old_bx, by, BALL_R + 1, graphics::color::BLACK);
      }

      if (keys & (keyboard::KEY_SPACE | keyboard::KEY_UP)) {
        bdx = BALL_SPEED;
        bdy = 0 - BALL_SPEED;
        state = STATE_PLAYING;
      }
    }

    if (state == STATE_PLAYING) {
      graphics::fill_circle(&fb, bx, by, BALL_R + 1, graphics::color::BLACK);

      bx = bx + bdx;
      by = by + bdy;

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

      if (state == STATE_PLAYING) {
        if (is_positive(bdy) && by + BALL_R >= PADDLE_Y && by - BALL_R <= PADDLE_Y + PADDLE_H) {
          if (bx >= px && bx <= px + PADDLE_W) {
            by = PADDLE_Y - BALL_R;
            bdy = 0 - abs(bdy);

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

      if (state == STATE_PLAYING) {
        for (var row: byte = 0; row < BRICK_ROWS; row = row + 1) {
          for (var col: byte = 0; col < BRICK_COLS; col = col + 1) {
            var idx = row * BRICK_COLS + col;
            if (!bricks[idx]) {
              continue;
            }
            var brick_x = BRICK_AREA_X + col * BRICK_STRIDE_X;
            var brick_y = BRICK_AREA_Y + row * BRICK_STRIDE_Y;

            if (bx + BALL_R > brick_x && bx - BALL_R < brick_x + BRICK_W &&
                by + BALL_R > brick_y && by - BALL_R < brick_y + BRICK_H) {
              bricks[idx] = 0;
              bricks_left = bricks_left - 1;
              score = score + (BRICK_ROWS - row) * 10;

              graphics::fill_rect(&fb, brick_x, brick_y, BRICK_W, BRICK_H, graphics::color::BLACK);

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

              if (bricks_left == 0) {
                state = STATE_WIN;
              }

              break;
            }
          }
          if (state == STATE_WIN) {
            break;
          }
        }
      }
    }

    if (state == STATE_DEAD) {
      graphics::font::draw_string(&fb, 112, 96, "GAME OVER", graphics::color::RED, graphics::color::BLACK);
      draw_ball(&fb, bx, by);
      draw_paddle(&fb, px);
      display::flip();
      break;
    }

    if (state == STATE_WIN) {
      graphics::font::draw_string(&fb, 120, 96, "YOU WIN!", graphics::color::YELLOW, graphics::color::BLACK);
      draw_ball(&fb, bx, by);
      draw_paddle(&fb, px);
      display::flip();
      break;
    }

    draw_ball(&fb, bx, by);
    draw_paddle(&fb, px);
    display::flip();
  }

  // Brief pause then clean up
  for (var w: byte = 0; w < 100; w = w + 1) {
    lib::yield();
  }

  display::close();
  return 0;
}
