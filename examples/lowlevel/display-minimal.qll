// Minimal display demo
// Run with: bun run bin/qrun.ts examples/lowlevel/display-minimal.qll -- --display 64x64

function main(): byte {
  // Display peripheral at 0x603
  var base = <unsafe *byte>0x603;
  var width = base[unsafe 1];
  var height = base[unsafe 2];

  // Framebuffer at 0x10000
  var fb = <unsafe *byte>0x10000;
  base[unsafe 3] = <unsafe byte>fb;

  // Fill with red
  var size = width * height;
  for (var i: byte = 0; i < size; i = i + 1) {
    fb[unsafe i] = 0xFF0000FF;  // RGBA red
  }

  // Flip
  base[unsafe 0] = 0x01;

  std::console::print("Done. Press Enter.\n");
  var buf: byte[16];
  std::console::input(buf);

  return 0;
}
