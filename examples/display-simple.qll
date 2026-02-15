// Simple display demo - basic shapes only.
// Run with: bun run qrun examples/display-simple.qll --display 320x200

function main(): byte {
  var fb = display::open(320, 200);

  // Clear to dark blue
  graphics::clear(&fb, graphics::rgb(0x20, 0x20, 0x60));

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

  // More rectangles
  graphics::fill_rect(&fb, 230, 20, 60, 40, graphics::color::YELLOW);
  graphics::rect(&fb, 20, 150, 100, 30, graphics::color::WHITE);
  graphics::fill_rect(&fb, 140, 150, 100, 30, graphics::color::GRAY);

  // Flip to display
  display::flip();

  // Keep window open
  std::console::print("Display demo running. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  display::close();
  return 0;
}
