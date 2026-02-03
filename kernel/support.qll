// Assembly-level support functions.
namespace kernel::support {
  function halt(code: error): void;
  function wait(): void;
  function wait_for_interrupt(): void;
  function interrupt(interrupt: interrupt, handler: () => void): void;
  function disable_interrupts(): void;
  function enable_interrupts(): void;

  // Interrupt trampolines - these switch to the kernel stack before calling handlers.
  // When an interrupt fires from userspace, SP contains the user's virtual stack
  // address. With MMU disabled, using this as a physical address corrupts memory.
  // These trampolines switch to a kernel stack first.
  function syscall_trampoline(): void;
  function timer_trampoline(): void;
  function error_trampoline(): void;
}
