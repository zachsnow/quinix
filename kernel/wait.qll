// Kernel wait, for code running in the kernel;
// probably we could schedule a user process, but for
// now just spin.
namespace std {
  function wait_while(ptr: *byte, value: byte): void {
    while (*ptr == value) {}
  }
}
