// Kernel wait - just spin for now.
// TODO: Could schedule another process, but syscall context is tricky.
namespace std {
  function wait_while(ptr: *byte, value: byte): void {
    while (*ptr == value) {}
  }
}
