// Simple display hello world
// Run with: bun run qrun examples/display-hello.qll --display 320x200

function main(): byte {
  var fb = display::open(320, 200);

  // Draw a few pixels directly
  graphics::set_pixel(&fb, 10, 10, graphics::color::RED);
  graphics::set_pixel(&fb, 11, 10, graphics::color::GREEN);
  graphics::set_pixel(&fb, 12, 10, graphics::color::BLUE);
  graphics::set_pixel(&fb, 10, 11, graphics::color::WHITE);

  // Show it
  display::flip();

  // Wait for input so window stays open
  std::console::print("Press Enter to exit\n");
  var buf: byte[8];
  std::console::input(buf);

  display::close();
  return 0;
}
