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

    // Point to 0x2 so that registers[0] maps to address 0x2 where VM stores r0.
    // The struct copy doesn"t include array length prefix, just the data.
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
      std::buffered::write(
        &peripherals::debug_output->control,
        &peripherals::debug_output->size,
        &peripherals::debug_output->buffer[unsafe 0],
        "\n"
      );
      return;
    }

    // Otherwise search the peripheral table for debug output.
    var debug_output_id: byte = 0x3;
    var table_count = <unsafe * byte>0x200;
    var table_base = <unsafe * byte>0x201;
    for (var i: byte = 0; i < *table_count; i = i + 1) {
      var entry_id = table_base[unsafe i * 2];
      if (entry_id == debug_output_id) {
        var entry_addr = table_base[unsafe i * 2 + 1];
        var base = <unsafe * byte>entry_addr;
        var ctrl = base;
        var sz = <unsafe * byte>(<unsafe byte>base + 2);
        var buf = <unsafe * byte>(<unsafe byte>base + 3);
        std::buffered::write(ctrl, sz, buf, message);
        std::buffered::write(ctrl, sz, buf, "\n");
        return;
      }
    }

    // Otherwise, we're effed.
    support::halt(error::NO_LOG);
  }

  function panic(message: byte[]): .abort void {
    log(message);
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

// Check if a process with the given PID exists.
function process_exists(pid: byte): bool {
  var procs = kernel::process::processes;
  for (var i: byte = 0; i < len procs; i = i + 1) {
    if (procs[i]->id == pid) {
      return true;
    }
  }
  return false;
}

// Wait for a process to exit.
function wait_for_process(pid: byte): void {
  kernel::support::enable_interrupts();
  while (process_exists(pid)) {
    kernel::support::wait_for_interrupt();
  }
  kernel::support::disable_interrupts();
}

// Load an executable from QFS and create a process.
function load_executable(path: byte[], parent_id: byte): byte {
  var slot = kernel::fs::qfs::file_open(path, kernel::fs::qfs::MODE_READ);
  if (slot == -1) {
    return 0;
  }

  var binary = new byte[0x1000];
  var ptr = &binary[0];
  var total: byte = 0;
  var n = kernel::fs::qfs::file_read(slot, ptr, 0x1000);
  while (n > 0) {
    total = total + n;
    ptr = <unsafe *byte>(<unsafe byte>ptr + n);
    n = kernel::fs::qfs::file_read(slot, ptr, 0x1000 - total);
  }
  len binary = total;
  kernel::fs::qfs::file_close(slot);

  if (total == 0) {
    delete binary;
    return 0;
  }

  var pid = kernel::process::create_process(binary, parent_id);
  delete binary;
  return pid;
}

function main(): void {
  kernel::support::disable_interrupts();
  kernel::init();

  kernel::log("starting shell...");
  shell::main();
}
