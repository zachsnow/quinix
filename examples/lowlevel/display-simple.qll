// Simple display demo - basic shapes only.
// Run with: bun run bin/qrun.ts examples/lowlevel/display-simple.qll -- --display 320x200

// Display peripheral base address
.constant global DISPLAY_BASE: byte = 0x602;

// Framebuffer in physical memory
.constant global FB_ADDR: byte = 0x10000;

function main(): byte {
  // Initialize display
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);

  // Clear to dark blue
  gfx::clear(&fb, gfx::rgb(0x20, 0x20, 0x60));

  // Draw some shapes
  // White border
  gfx::rect(&fb, 10, 10, 300, 180, gfx::color::WHITE);

  // Colored rectangles
  gfx::fill_rect(&fb, 20, 20, 60, 40, gfx::color::RED);
  gfx::fill_rect(&fb, 90, 20, 60, 40, gfx::color::GREEN);
  gfx::fill_rect(&fb, 160, 20, 60, 40, gfx::color::BLUE);

  // Lines
  gfx::line(&fb, 20, 80, 280, 80, gfx::color::YELLOW);
  gfx::line(&fb, 20, 80, 150, 140, gfx::color::CYAN);
  gfx::line(&fb, 280, 80, 150, 140, gfx::color::MAGENTA);

  // More rectangles
  gfx::fill_rect(&fb, 230, 20, 60, 40, gfx::color::YELLOW);
  gfx::rect(&fb, 20, 150, 100, 30, gfx::color::WHITE);
  gfx::fill_rect(&fb, 140, 150, 100, 30, gfx::color::GRAY);

  // Flip to display
  display::flip(DISPLAY_BASE);

  // Keep window open
  std::console::print("Display demo running. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  return 0;
}
