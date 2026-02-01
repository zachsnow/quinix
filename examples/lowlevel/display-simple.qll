// Simple display demo - basic shapes only.
// Run with: bun run bin/qrun.ts examples/lowlevel/display-simple.qll -- --display 320x200

// Display peripheral base address
.constant global DISPLAY_BASE: byte = 0x603;

// Framebuffer in physical memory
.constant global FB_ADDR: byte = 0x10000;

function main(): byte {
  // Initialize display
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);

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
  display::flip(DISPLAY_BASE);

  // Keep window open
  std::console::print("Display demo running. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  return 0;
}
