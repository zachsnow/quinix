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

  type interrupt = byte;
  namespace interrupt {
    .constant global ERROR: interrupt = 0x1;
    .constant global TIMER: interrupt = 0x2;
    .constant global SYSCALL: interrupt = 0x80;
  }

  namespace interrupts {
    type state = struct {
      registers: byte[64];
      ip: byte;
    };

    global state: * state = <unsafe * state>0x2;

    global _interrupts_enabled: .notnull * bool = null; // Lives at 0x0000.

    function disable(): void {
      *_interrupts_enabled = false;
    }

    function enable(): void {
      *_interrupts_enabled = true;
    }
  }

  function log(message: byte[]): void {
    // If peripherals have been properly configured, just use that.
    // For now we log to the console.
    if(peripherals::debug_output){
      std::buffered::write(
        &peripherals::debug_output->control,
        peripherals::debug_output->buffer,
        message,
      );
      return;
    }

    // Otherwise hard-code access to the debug output peripheral if it is
    // located where we expect.
    var debug_output_identifier = 0x2;
    var debug_output_identifier_ptr = <unsafe * byte> 0x103;
    var debug_output_ptr = <unsafe * byte> 0x104;
    if(*debug_output_identifier_ptr == debug_output_identifier){
      var debug_output_control = <unsafe * byte> *debug_output_ptr;
      var debug_output_buffer = *<unsafe * byte[]>(<unsafe byte>debug_output_ptr + 1);
      std::buffered::write(debug_output_control, debug_output_buffer, message);
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

  function init(): void {
    peripherals::init();
    scheduler::init();
  }
}

function main(): void {
  kernel::interrupts::disable();
  kernel::init();

  // Load the shell and create a task for it.
  if(!std::buffered::write(&kernel::peripherals::debug_file->control, kernel::peripherals::debug_file->buffer, 'shell')){
    kernel::panic('unable to write shell path');
  }

  var size = std::buffered::read_size(&kernel::peripherals::debug_file->control, kernel::peripherals::debug_file->buffer);
  if(size < 1){
    kernel::panic('unable to read shell size');
  }

  var binary = new byte[size];
  if(!binary){
    kernel::panic('unable to allocate memory for shell');
  }

  if(!std::buffered::read(&kernel::peripherals::debug_file->control, kernel::peripherals::debug_file->buffer, binary)){
    kernel::panic('unable to read shell');
  }

  if(!kernel::process::create(binary)){
    kernel::panic('unable to create shell task');
  }

  delete binary;

  kernel::enable_interrupts();
  while(true){
    kernel::support::wait();
  }
}
