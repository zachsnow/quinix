// Example program that triggers a fault by writing to an unmapped address.
// When run in the kernel, the error handler will print the fault reason.
function main(args: byte[]): byte {
  lib::print("About to fault...\n");

  // Write to an address in the guard page between executable and heap.
  // Executable: 0x1000-0x9000, guard: 0x9000-0xA000, heap: 0xA000+
  var bad_ptr = <unsafe * byte>0x9500;
  *bad_ptr = 0x42;

  // Should never reach here.
  lib::print("This should not print.\n");
  return 0;
}
