// Bare-metal keyboard peripheral interface.
// KeypressPeripheral (0x10) must be enabled with --keyboard flag.
//
// With default qvm peripheral set + display + keyboard:
//   0x603: Display (4 words)
//   0x607: Keyboard (5 words)
//
// Memory layout at base address (5 words):
//   +0: Special/modifier key bitmask
//   +1: ASCII 0-31 key state (bit N = key with ASCII code N)
//   +2: ASCII 32-63 key state (bit N = key with ASCII code 32+N)
//   +3: ASCII 64-95 key state (bit N = key with ASCII code 64+N)
//   +4: ASCII 96-127 key state (bit N = key with ASCII code 96+N)

namespace keyboard {
  // Special/modifier key bits (word 0)
  .constant global KEY_LEFT: byte = 0x01;
  .constant global KEY_RIGHT: byte = 0x02;
  .constant global KEY_UP: byte = 0x04;
  .constant global KEY_DOWN: byte = 0x08;
  .constant global KEY_SPACE: byte = 0x10;
  .constant global KEY_ESCAPE: byte = 0x20;
  .constant global KEY_ENTER: byte = 0x40;
  .constant global KEY_TAB: byte = 0x80;
  .constant global KEY_BACKSPACE: byte = 0x100;
  .constant global KEY_DELETE: byte = 0x200;
  .constant global KEY_SHIFT: byte = 0x400;
  .constant global KEY_CTRL: byte = 0x800;
  .constant global KEY_ALT: byte = 0x1000;
  .constant global KEY_META: byte = 0x2000;

  // Keyboard state
  type state = struct {
    base: *byte;
  };

  // Initialize keyboard from base address
  function init(base: byte): state {
    return state {
      base = <unsafe *byte>base,
    };
  }

  // Read the special/modifier key bitmask (word 0)
  function read(kb: *state): byte {
    return *kb->base;
  }

  // Check if a special/modifier key is held (checks word 0)
  function held(kb: *state, key: byte): bool {
    return (*kb->base & key) != 0;
  }

  // Check if an ASCII key is held (e.g. 'q', 'a', '1')
  function key(kb: *state, ascii: byte): bool {
    var word = 1 + (ascii / 32);
    var bit: byte = 1;
    var shift = ascii % 32;
    while (shift > 0) {
      bit = bit * 2;
      shift = shift - 1;
    }
    var ptr = <unsafe *byte>(<unsafe byte>kb->base + word);
    return (*ptr & bit) != 0;
  }
}
