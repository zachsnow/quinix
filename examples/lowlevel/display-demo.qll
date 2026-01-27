// Display demo - shows graphics primitives and text rendering.
// Run with: bun run bin/qrun.ts examples/lowlevel/display-demo.qll -- --display 320x200

// Display peripheral base address (after Timer, DebugBreak, DebugOutput, DebugInput, DebugFile)
.constant global DISPLAY_BASE: byte = 0x602;

// Framebuffer in physical memory (after peripheral region)
// 320x200 = 64000 pixels = 64000 words = 0xFA00 words
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

  // Text
  gfx::font::draw_string(&fb, 20, 150, "Hello, Quinix!", gfx::color::WHITE, gfx::rgb(0x20, 0x20, 0x60));
  gfx::font::draw_string(&fb, 20, 160, "320x200 @ 32bpp", gfx::color::GRAY, gfx::rgb(0x20, 0x20, 0x60));
  gfx::font::draw_string(&fb, 20, 170, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", gfx::color::WHITE, gfx::rgb(0x20, 0x20, 0x60));

  // Flip to display
  display::flip(DISPLAY_BASE);

  // Keep window open
  std::console::print("Display demo running. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  return 0;
}
