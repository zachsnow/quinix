// Display demo - shows graphics primitives and text rendering.
// Run with: bun run bin/qrun.ts examples/display-demo.qll -- --display 320x200

function main(): byte {
  var fb = display::open(320, 200);

  // Pre-compute background color to avoid nested function calls
  var bg = graphics::rgb(0x20, 0x20, 0x60);

  // Clear to dark blue
  graphics::clear(&fb, bg);

  // Draw some shapes
  // White border
  graphics::rect(&fb, 10, 10, 300, 180, graphics::color::WHITE);

  // Colored rectangles
  graphics::fill_rect(&fb, 20, 20, 60, 40, graphics::color::RED);
  graphics::fill_rect(&fb, 90, 20, 60, 40, graphics::color::GREEN);
  graphics::fill_rect(&fb, 160, 20, 60, 40, graphics::color::BLUE);

  // Lines
  graphics::line(&fb, 20, 80, 280, 80, graphics::color::YELLOW);
  graphics::line(&fb, 20, 80, 150, 140, graphics::color::CYAN);
  graphics::line(&fb, 280, 80, 150, 140, graphics::color::MAGENTA);

  // Text
  graphics::font::draw_string(&fb, 20, 150, "Hello, Quinix!", graphics::color::WHITE, bg);
  graphics::font::draw_string(&fb, 20, 160, "320x200 @ 32bpp", graphics::color::GRAY, bg);
  graphics::font::draw_string(&fb, 20, 170, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", graphics::color::WHITE, bg);

  // Flip to display
  display::flip();

  // Keep window open
  std::console::print("Display demo running. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  display::close();
  return 0;
}
