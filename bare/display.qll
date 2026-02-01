// Bare-metal display peripheral interface.
// DisplayPeripheral (0x5) is mapped after other debug peripherals.
//
// With default qvm peripheral set, display is at 0x602:
//   0x300: Timer (1 word)
//   0x301: DebugBreak (1 word)
//   0x302: DebugOutput (0x100 words)
//   0x402: DebugInput (0x100 words)
//   0x502: DebugFile (0x100 words)
//   0x602: Display (4 words)
//
// Memory layout at base address:
//   +0: Control (write 0x01 to flip)
//   +1: Width (read-only)
//   +2: Height (read-only)
//   +3: Framebuffer pointer (write physical address)

namespace display {
  // Control register values
  .constant global READY: byte = 0x00;
  .constant global FLIP: byte = 0x01;
  .constant global PENDING: byte = 0x02;

  // Display peripheral state
  type peripheral = struct {
    control: *byte;
    width: byte;
    height: byte;
    pointer: *byte;
  };

  // Initialize display peripheral from base address.
  // Returns a graphics::framebuffer ready for drawing.
  function init(base: byte, fb_memory: *byte): graphics::framebuffer {
    var base_ptr = <unsafe *byte>base;
    var width = base_ptr[unsafe 1];
    var height = base_ptr[unsafe 2];

    // Set the framebuffer pointer in the peripheral
    base_ptr[unsafe 3] = <unsafe byte>fb_memory;

    return graphics::framebuffer {
      pixels = fb_memory,
      width = width,
      height = height,
    };
  }

  // Flip the display (copy framebuffer to screen)
  function flip(base: byte): void {
    var control = <unsafe *byte>base;
    *control = FLIP;
    // Wait for flip to complete
    while (*control == PENDING) { }
  }
}
