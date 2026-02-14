// Bare-metal display peripheral interface.
// Matches the user-mode API so programs can compile for either target.
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

  // Default peripheral address and framebuffer location
  .constant global _DISPLAY_BASE: byte = 0x603;
  .constant global _FB_ADDR: byte = 0x10000;

  // Stored control pointer for flip()
  global _control: *byte = null;

  // Open the display at the requested resolution and get a framebuffer.
  function open(width: byte, height: byte): graphics::framebuffer {
    var base_ptr = <unsafe *byte>_DISPLAY_BASE;
    _control = base_ptr;

    // Set the framebuffer pointer in the peripheral
    var fb_memory = <unsafe *byte>_FB_ADDR;
    base_ptr[unsafe 3] = <unsafe byte>fb_memory;

    return graphics::framebuffer {
      pixels = fb_memory,
      width = base_ptr[unsafe 1],
      height = base_ptr[unsafe 2],
    };
  }

  // Flip the display (copy framebuffer to screen).
  function flip(): void {
    *_control = FLIP;
    std::wait_while(_control, PENDING);
  }

  // Release the display (no-op for bare-metal).
  function close(): void {
  }
}
