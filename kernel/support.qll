// Assembly-level support functions.
namespace kernel::support {
  function halt(code: error): void;
  function wait(): void;
  function interrupt(interrupt: interrupt, handler: () => void): void;
}
