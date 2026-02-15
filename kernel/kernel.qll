// Outline:
// * Configure all peripherals.
// * Configure interrupt handlers.
// * Enter idle loop.
namespace kernel {
  global verbose: bool = true;

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
    global state: * state = <unsafe * state>0x2;

  }

  type fault_reason = byte;
  namespace fault_reason {
    .constant global INVALID_INSTRUCTION: fault_reason = 0x1;
    .constant global UNIMPLEMENTED_INSTRUCTION: fault_reason = 0x2;
    .constant global MEMORY_FAULT: fault_reason = 0x3;
    .constant global OUT_OF_BOUNDS: fault_reason = 0x4;
    .constant global INVALID_INTERRUPT: fault_reason = 0x5;

    // The fault reason is stored at address 0x43 (after 65 saved registers + 2 header bytes).
    global reason: * fault_reason = <unsafe * fault_reason>0x43;
  }

  function log(message: byte[]): void {
    if (!verbose) {
      return;
    }

    // If peripherals have been properly configured, just use that.
    if(peripherals::debug_output){
      std::console::print(message);
      std::console::print("\n");
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

    // Otherwise, we're fucked.
    support::halt(error::NO_LOG);
  }

  function panic(message: byte[]): .abort void {
    log(message);
    support::halt(error::PANIC);
  }

  function init(): void {
    log("kernel: initializing...");

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
function load_executable(path: byte[], parent_id: byte, args: byte[], args_len: byte): byte {
  kernel::log("load: opening file");
  var slot = kernel::fs::qfs::file_open(path, kernel::fs::qfs::MODE_READ);
  if (slot == -1) {
    kernel::log("load: file not found");
    return 0;
  }

  // Allocate buffer matching the executable page size. Binaries larger than
  // this can't fit in the executable page and must be rejected.
  var max_size = kernel::process::DEFAULT_EXECUTABLE_SIZE;
  var binary = new byte[max_size];
  var ptr = &binary[0];
  var total: byte = 0;

  // Read words (not bytes) since binaries are 32-bit word-oriented.
  kernel::log("load: reading file");
  var n = kernel::fs::qfs::file_read_words(slot, ptr, max_size);
  while (n > 0) {
    total = total + n;
    ptr = <unsafe *byte>(<unsafe byte>ptr + n);
    n = kernel::fs::qfs::file_read_words(slot, ptr, max_size - total);
  }

  // Check if the file had more data than we could read.
  var overflow: byte = 0;
  if (total == max_size) {
    var dummy: byte = 0;
    if (kernel::fs::qfs::file_read_words(slot, &dummy, 1) > 0) {
      overflow = 1;
    }
  }

  len binary = total;
  kernel::fs::qfs::file_close(slot);

  if (overflow) {
    kernel::log("load: binary too large for executable page");
    delete binary;
    return 0;
  }

  kernel::log("load: creating process");
  if (total == 0) {
    kernel::log("load: no data read");
    delete binary;
    return 0;
  }

  var pid = kernel::process::create_process(binary, parent_id, args, args_len);
  kernel::log("load: process created");
  delete binary;
  return pid;
}

function main(): void {
  kernel::support::disable_interrupts();
  kernel::init();

  kernel::log("starting shell...");
  shell::main();
}
