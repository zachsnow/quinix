// Usermode display and keyboard interface via syscalls.
//
// Usage:
//   var fb = display::open(320, 200);
//   graphics::fill_rect(&fb, 0, 0, 100, 100, graphics::color::RED);
//   display::flip();
//   display::close();

namespace display {
  // Open the display at the requested resolution and get a framebuffer.
  // Returns a graphics::framebuffer with pixels mapped into this process's
  // virtual address space. Only one process can own the display at a time.
  function open(width: byte, height: byte): graphics::framebuffer {
    var result: byte[3];
    lib::support::syscall3(
      lib::support::DISPLAY_OPEN_SYSCALL,
      <unsafe byte>&result[0],
      width,
      height
    );
    return graphics::framebuffer {
      pixels = <unsafe *byte>result[0],
      width = result[1],
      height = result[2],
    };
  }

  // Flip the display (present the framebuffer to screen).
  function flip(): void {
    lib::support::syscall(lib::support::DISPLAY_FLIP_SYSCALL);
  }

  // Release the display.
  function close(): void {
    lib::support::syscall(lib::support::DISPLAY_CLOSE_SYSCALL);
  }
}

namespace keyboard {
  // Key bitmask bits (match SDL renderer KEY_BIT_* constants)
  .constant global KEY_LEFT: byte = 0x01;
  .constant global KEY_RIGHT: byte = 0x02;
  .constant global KEY_UP: byte = 0x04;
  .constant global KEY_DOWN: byte = 0x08;
  .constant global KEY_SPACE: byte = 0x10;
  .constant global KEY_ESCAPE: byte = 0x20;

  // Read the current key state bitmask via syscall.
  function read(): byte {
    return lib::support::syscall(lib::support::KEY_STATE_SYSCALL);
  }

  // Check if a specific key is currently held down.
  function held(keys: byte, key: byte): bool {
    return (keys & key) != 0;
  }
}
