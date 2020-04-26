// Outline:
// * Configure all peripherals.
// * Configure interrupt handlers.
// * Enter idle loop.
namespace kernel {
  // Assembly-level support functions.
  namespace support {
    function halt(message: byte[]): void;
    function wait(): byte;

    type interrupt_handler: (byte) => void;
    function interrupt(handler: interrupt_handler, interrupt: byte): void;
  }

  // Print the given message and halt the machine.
  function panic(message: byte[]): void {
    // We can't assume that `peripherals` has been initialized.
    var peripheralTable: *byte = <* byte>0x100;
    if(peripherals::debug_output_ptr){
      peripherals::buffered_write(peripherals::debug_output_ptr, message);
    }
    else if(peripheralTable + 0x1 == 0x3){
      // If the debug output peripheral is mapped in the
      // exected location, write the given message.
      var debugOutputControl: *byte = <* byte> 0x302;
      var debugOutputBuffer: *byte = <* byte> 0x303;

      var i = 0;
      var n = len s;
      debugOutputBuffer[0] = n;
      while(i < n){
          debugOutputBuffer[i + 1] = s[i];
          i = i + 1;
      }

      *debugOutputControl = 0x1;

      while(*debugOutputControl == 0x2){}
    }

    support::halt(message);
  }

  function init(): void {
    peripherals::init();
    syscall::init();
    memory::init();
    scheduler::init();
  }
}

function main(): void {
  kernel::init();
}
