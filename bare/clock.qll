// Bare-metal clock peripheral interface.
// Matches the user-mode API so programs can compile for either target.
//
// Returns milliseconds since VM start.

namespace clock {
  .constant global _CLOCK_BASE: byte = 0x301;

  // Read the current time in milliseconds.
  function now(): byte {
    var ptr = <unsafe *byte>_CLOCK_BASE;
    return *ptr;
  }
}
