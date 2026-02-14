// User-mode clock interface via syscall.
// Matches the bare-metal API so programs can compile for either target.
//
// Returns milliseconds since VM start.

namespace clock {
  // Read the current time in milliseconds.
  function now(): byte {
    return lib::support::syscall(lib::support::CLOCK_NOW_SYSCALL);
  }
}
