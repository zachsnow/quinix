// Bare-metal wait - just spin.
namespace std {
  function wait_while(ptr: *byte, value: byte): void {
    while (*ptr == value) {}
  }
}
