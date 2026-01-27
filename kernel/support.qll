// Assembly-level support functions.
namespace kernel::support {
  function halt(code: error): void;
  function wait(): void;
  function wait_for_interrupt(): void;
  function interrupt(interrupt: interrupt, handler: () => void): void;
  function disable_interrupts(): void;
  function enable_interrupts(): void;
}
