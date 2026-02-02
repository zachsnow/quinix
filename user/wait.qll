// Userspace wait - yield to scheduler while spinning.
namespace std {
  function wait_while(ptr: *byte, value: byte): void {
    while (*ptr == value) {
      lib::yield();
    }
  }
}
