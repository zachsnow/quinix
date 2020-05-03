// Outline:
// * Configure all peripherals.
// * Configure interrupt handlers.
// * Enter idle loop.
namespace kernel {
  type error = byte;
  namespace error {
    .constant global PANIC: error = -1;
    .constant global NO_LOG: error = -2;
  }

  function log(message: byte[]): void {
    // If peripherals have been properly configured, just use that.
    // For now we log to the console.
    if(peripherals::debug_output_ptr){
      std::buffered::write(&peripherals::debug_output_ptr.control, peripherals::debug_output_ptr.buffer, message);
      return;
    }

    // Otherwise hard-code access to the debug output peripheral if it is
    // located where we expect.
    var debugOutputIdentifier = 0x2;
    var debugOutputIdentifierPtr = <unsafe * byte> 0x103;
    var debugOutputPtr = <unsafe * byte> 0x104;
    if(*debugOutputIdentifierPtr == debugOutputIdentifier){
      var debugOutputControl = <unsafe * byte> *debugOutputPtr;
      var debugOutputBuffer = *<unsafe * byte[]>(<unsafe byte>debugOutputPtr + 1);
      std::buffered::write(debugOutputControl, debugOutputBuffer, message);
      return;
    }

    // Otherwise, we're effed.
    support::halt(error::NO_LOG);
  }

  function panic(message: byte[]): .abort void {
    log(message);
    log('\n');
    support::halt(error::PANIC);
  }

  global interrupts_enabled: .notnull * bool = null; // INTERRUPTS_ENABLED lives at 0x0000.

  function disable_interrupts(): void {
    *interruptsEnabled = false;
  }

  function enable_interrupts(): void {
    *interruptsEnabled = true;
  }

  function init(): void {
    peripherals::init();
    scheduler::init();
  }
}

function main(): void {
  kernel::disable_interrupts();
  kernel::init();

  // Load the shell and create a task for it.
  if(!std::buffered::write(&peripherals::debug_file->control, peripherals::debug_file->buffer, 'shell')){
    kernel::panic('unable to write shell path');
  }

  var size = std::buffered::read_size(&peripherals::debug_file->control, peripherals::debug_file->buffer);
  var binary = new byte[size];
  if(!binary){
    kernel::panic('unable to allocate memory for shell');
  }

  if(!std::buffered::read(&peripherals::debug_file->control, peripherals::debug_file->buffer, binary)){
    kernel::panic('unable to read shell');
  }

  if(!kernel::process::create(binary)){
    kernel::panic('unable to create shell task');
  }

  delete binary;

  kernel::enable_interrupts();
  kernel::support::wait();
}
