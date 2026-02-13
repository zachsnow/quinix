// Bare-metal keyboard peripheral interface.
// KeypressPeripheral (0x10) must be enabled with --keyboard flag.
//
// With default qvm peripheral set + display + keyboard:
//   0x603: Display (4 words)
//   0x607: Keyboard (1 word)
//
// Memory layout at base address:
//   +0: Key state bitmask (bits set while keys are held down)

namespace keyboard {
  // Key bitmask bits (match SDL renderer KEY_BIT_* constants)
  .constant global KEY_LEFT: byte = 0x01;
  .constant global KEY_RIGHT: byte = 0x02;
  .constant global KEY_UP: byte = 0x04;
  .constant global KEY_DOWN: byte = 0x08;
  .constant global KEY_SPACE: byte = 0x10;
  .constant global KEY_ESCAPE: byte = 0x20;

  // Keyboard state
  type state = struct {
    keys_ptr: *byte;
  };

  // Initialize keyboard from base address
  function init(base: byte): state {
    return state {
      keys_ptr = <unsafe *byte>base,
    };
  }

  // Read the current key state bitmask
  function read(kb: *state): byte {
    return *kb->keys_ptr;
  }

  // Check if a specific key is currently held down
  function held(kb: *state, key: byte): bool {
    return (*kb->keys_ptr & key) != 0;
  }
}
