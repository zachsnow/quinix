// Hello World display demo
// Run with: bun run qrun examples/hello-display.qll -- --display 320x200

function main(): byte {
  var fb = display::open(320, 200);

  // Clear to dark blue
  graphics::clear(&fb, graphics::rgb(0x10, 0x10, 0x40));

  // Draw "Hello, World!" centered
  graphics::font::draw_string(&fb, 100, 96, "Hello, World!", graphics::color::WHITE, graphics::rgb(0x10, 0x10, 0x40));

  // Flip to display
  display::flip();

  // Keep window open
  std::console::print("Hello World demo. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  display::close();
  return 0;
}
