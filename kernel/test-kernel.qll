namespace kernel {
  // Assembly-level support functions.
  namespace support {
    function halt(code: byte): void;
    function wait(): byte;
  }
}

function main(): void {
  kernel::support::halt(42);
}
