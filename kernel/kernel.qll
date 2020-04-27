// Outline:
// * Configure all peripherals.
// * Configure interrupt handlers.
// * Enter idle loop.
namespace kernel {
  function log(message: byte[]): void {
    // Hard-code for now.
    var debugOutputControl = <unsafe * byte> 0x302;
    var debugOutputBuffer = <unsafe * byte> 0x303;

    // Copy.
    debugOutputBuffer[0] = len message;
    for(var i = 0; i < len message && i < 0xff; i = i + 1){
      debugOutputBuffer[i + 1] = message[i];
    }

    // Write.
    *debugOutputControl = 0x1;

    // Wait for success.
    while(*debugOutputControl == 0x2){}
  }

  function panic(message: byte[]): void {
    log(message);
    support::halt(message);
  }

  function init(): void {
    peripherals::init();
    scheduler::init();
  }
}

function main(): void {
  kernel::init();
  kernel::support::wait();
}
