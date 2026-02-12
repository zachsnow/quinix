// Bare-metal keyboard peripheral interface.
// KeypressPeripheral (0x10) must be enabled with --keyboard flag.
//
// With default qvm peripheral set + display + keyboard:
//   0x603: Display (4 words)
//   0x607: Keyboard (2 words)
//
// Memory layout at base address:
//   +0: Key code (first char of key name, e.g. 'l' for left arrow)
//   +1: Event counter (increments on each keypress)

namespace keyboard {
  // Key codes (first character of Node.js key.name)
  .constant global KEY_LEFT: byte = 'l';    // "left"
  .constant global KEY_RIGHT: byte = 'r';   // "right"
  .constant global KEY_UP: byte = 'u';      // "up"
  .constant global KEY_DOWN: byte = 'd';    // "down"
  .constant global KEY_SPACE: byte = 's';   // "space"
  .constant global KEY_RETURN: byte = 'r';  // "return" (same as right)
  .constant global KEY_ESCAPE: byte = 'e';  // "escape"

  // Keyboard state
  type state = struct {
    key_ptr: *byte;
    counter_ptr: *byte;
    last_counter: byte;
  };

  // Initialize keyboard from base address
  function init(base: byte): state {
    var base_ptr = <unsafe *byte>base;
    return state {
      key_ptr = base_ptr,
      counter_ptr = <unsafe *byte>(base + 1),
      last_counter = 0,
    };
  }

  // Read the current key code (0 if no key pressed yet)
  function read(kb: *state): byte {
    return *kb->key_ptr;
  }

  // Check if a new key event has occurred since last poll
  function poll(kb: *state): byte {
    var counter = *kb->counter_ptr;
    if (counter != kb->last_counter) {
      kb->last_counter = counter;
      return *kb->key_ptr;
    }
    return 0;
  }
}
