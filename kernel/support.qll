// Assembly-level support functions.
namespace kernel {
  namespace support {
    function halt(code: byte[]): void;
    function wait(): void;
    function interrupt(interrupt: byte, handler: () => void): void;
  }
}
