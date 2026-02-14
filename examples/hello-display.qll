// Hello World display demo
// Run with: bun run bin/qrun.ts examples/lowlevel/hello-display.qll -- --display 320x200

.constant global DISPLAY_BASE: byte = 0x603;
.constant global FB_ADDR: byte = 0x10000;

function main(): byte {
  // Initialize display
  var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);

  // Clear to dark blue
  graphics::clear(&fb, graphics::rgb(0x10, 0x10, 0x40));

  // Draw "Hello, World!" centered
  graphics::font::draw_string(&fb, 100, 96, "Hello, World!", graphics::color::WHITE, graphics::rgb(0x10, 0x10, 0x40));

  // Flip to display
  display::flip(DISPLAY_BASE);

  // Keep window open
  std::console::print("Hello World demo. Press Enter to exit.\n");
  var buf: byte[16];
  std::console::input(buf);

  return 0;
}
