// Bouncing ball demo with FPS counter
.constant global CLOCK_BASE: byte = 0x301;
.constant global DISPLAY_BASE: byte = 0x603;
.constant global FB_ADDR: byte = 0x10000;

.constant global BALL_SIZE: byte = 8;
.constant global SCREEN_W: byte = 320;
.constant global SCREEN_H: byte = 200;

// Read milliseconds from clock peripheral
function clock_read(): byte {
  var clock = <unsafe *byte>CLOCK_BASE;
  return *clock;
}

// Convert number to decimal string (up to 5 digits)
function itoa(n: byte, buf: byte[]): void {
  var i: byte = 0;
  var tmp: byte[5];

  if (n == 0) {
    buf[0] = '0';
    buf[1] = 0;
    return;
  }

  while (n > 0 && i < 5) {
    tmp[i] = '0' + (n % 10);
    n = n / 10;
    i = i + 1;
  }

  // Reverse into buf
  var j: byte = 0;
  while (i > 0) {
    i = i - 1;
    buf[j] = tmp[i];
    j = j + 1;
  }
  buf[j] = 0;
}

function main(): byte {
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);

  var x: byte = 50;
  var y: byte = 50;
  var dir_right: bool = true;
  var dir_down: bool = true;

  // FPS tracking
  var frames: byte = 0;
  var fps: byte = 0;
  var last_fps: byte = 0;
  var last_time: byte = clock_read();
  var fps_buf: byte[6];

  while (true) {
    // Clear old ball position
    graphics::fill_rect(&fb, x, y, BALL_SIZE, BALL_SIZE, graphics::color::BLACK);

    // Update position
    if (dir_right) {
      x = x + 1;
    } else {
      x = x - 1;
    }
    if (dir_down) {
      y = y + 1;
    } else {
      y = y - 1;
    }

    // Bounce off edges
    if (x <= 0) {
      dir_right = true;
    }
    if (x + BALL_SIZE >= SCREEN_W) {
      dir_right = false;
    }
    if (y <= 0) {
      dir_down = true;
    }
    if (y + BALL_SIZE >= SCREEN_H) {
      dir_down = false;
    }

    // Draw ball
    graphics::fill_rect(&fb, x, y, BALL_SIZE, BALL_SIZE, graphics::color::RED);

    // FPS calculation
    frames = frames + 1;
    var now = clock_read();
    if (now - last_time >= 1000) {
      fps = frames;
      frames = 0;
      last_time = now;
    }

    // Only redraw FPS when it changes
    if (fps != last_fps) {
      graphics::fill_rect(&fb, 4, 4, 40, 8, graphics::color::BLACK);
      itoa(fps, fps_buf);
      graphics::font::draw_string(&fb, 4, 4, fps_buf, graphics::color::WHITE, graphics::color::BLACK);
      last_fps = fps;
    }

    // Show it
    display::flip(DISPLAY_BASE);
  }

  return 0;
}
