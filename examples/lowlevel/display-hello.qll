// Simple display hello world
.constant global DISPLAY_BASE: byte = 0x602;
.constant global FB_ADDR: byte = 0x10000;

function main(): byte {
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);

  // Draw a few pixels directly
  gfx::set_pixel(&fb, 10, 10, gfx::color::RED);
  gfx::set_pixel(&fb, 11, 10, gfx::color::GREEN);
  gfx::set_pixel(&fb, 12, 10, gfx::color::BLUE);
  gfx::set_pixel(&fb, 10, 11, gfx::color::WHITE);

  // Show it
  display::flip(DISPLAY_BASE);

  // Wait for input so window stays open
  std::console::print("Press Enter to exit\n");
  var buf: byte[8];
  std::console::input(buf);

  return 0;
}
