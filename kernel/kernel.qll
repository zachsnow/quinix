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

  namespace interrupts {
    .constant global ERROR: interrupt = 0x1;
    .constant global TIMER: interrupt = 0x2;
    .constant global SYSCALL: interrupt = 0x80;

    type state = struct {
      registers: byte[64];
      ip: byte;
    };

    global state: * state = <unsafe * state>0x2;

  }

  function log(message: byte[]): void {
    // If peripherals have been properly configured, just use that.
    if(peripherals::debug_output){
      std::buffered::write(
        &peripherals::debug_output->control,
        &peripherals::debug_output->size,
        &peripherals::debug_output->buffer[unsafe 0],
        message
      );
      return;
    }

    // Otherwise hard-code access to the debug output peripheral if it is
    // located where we expect.
    var debug_output_identifier = 0x3;
    var debug_output_identifier_ptr = <unsafe * byte> 0x201;
    var debug_output_ptr = <unsafe * byte> 0x202;
    if(*debug_output_identifier_ptr == debug_output_identifier){
      var debug_output_base = <unsafe * byte> *debug_output_ptr;
      var debug_output_control = debug_output_base;
      var debug_output_size = <unsafe * byte>(<unsafe byte>debug_output_base + 2);
      var debug_output_buffer = <unsafe * byte>(<unsafe byte>debug_output_base + 3);
      std::buffered::write(debug_output_control, debug_output_size, debug_output_buffer, message);
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
    memory::init();
    process::init();
    syscall::init();
    scheduler::init();
  }
}

// Load a program from the file peripheral and create a process for it.
function _load_program(path: byte[], parent_id: byte): byte {
  // Set the file path
  if(!std::buffered::write(
    &kernel::peripherals::debug_file->control,
    &kernel::peripherals::debug_file->size,
    &kernel::peripherals::debug_file->buffer[unsafe 0],
    path
  )){
    kernel::panic('unable to write program path');
  }

  // Allocate a buffer to hold the file
  var binary = new byte[0x1000];  // 4KB should be enough
  if (len binary == 0) {
    kernel::panic('unable to allocate memory for program');
  }

  // Read the file contents
  if(!std::buffered::read(
    &kernel::peripherals::debug_file->control,
    &kernel::peripherals::debug_file->size,
    &kernel::peripherals::debug_file->buffer[unsafe 0],
    binary
  )){
    kernel::panic('unable to read program');
  }

  // Create process
  var pid = kernel::process::create_process(binary, parent_id);
  if(!pid){
    kernel::panic('unable to create process');
  }

  delete binary;
  return pid;
}

function main(): void {
  kernel::support::disable_interrupts();
  kernel::init();

  kernel::log('loading test programs...\n');

  // Load test program A
  var pid_a = _load_program('tests/hello-a', 0);
  kernel::log('loaded hello-a\n');

  // Load test program B
  var pid_b = _load_program('tests/hello-b', 0);
  kernel::log('loaded hello-b\n');

  kernel::log('starting scheduler...\n');
  kernel::support::enable_interrupts();
  while(true){
    kernel::support::wait();
  }
}
