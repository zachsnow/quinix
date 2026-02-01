// Simple display hello world
.constant global DISPLAY_BASE: byte = 0x603;
.constant global FB_ADDR: byte = 0x10000;

function main(): byte {
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);

  // Draw a few pixels directly
  graphics::set_pixel(&fb, 10, 10, graphics::color::RED);
  graphics::set_pixel(&fb, 11, 10, graphics::color::GREEN);
  graphics::set_pixel(&fb, 12, 10, graphics::color::BLUE);
  graphics::set_pixel(&fb, 10, 11, graphics::color::WHITE);

  // Show it
  display::flip(DISPLAY_BASE);

  // Wait for input so window stays open
  std::console::print("Press Enter to exit\n");
  var buf: byte[8];
  std::console::input(buf);

  return 0;
}
