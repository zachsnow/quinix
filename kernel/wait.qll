// Kernel wait - no-op for now.
// TODO: Could schedule another process, but syscall context is tricky.
namespace std {
  function wait(): void {}
}
