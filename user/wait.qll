// Userspace wait - yield to scheduler.
namespace std {
  function wait(): void {
    lib::yield();
  }
}
