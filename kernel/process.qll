namespace kernel {
  namespace process {
    // Configuration
    .constant global DEFAULT_EXECUTABLE_BASE: byte = 0x1000;
    .constant global DEFAULT_EXECUTABLE_SIZE: byte = 0x8000;  // 32KB
    .constant global DEFAULT_HEAP_SIZE: byte = 0x10000;       // 64KB to match user alloc.qll
    .constant global DEFAULT_STACK_SIZE: byte = 0x10000;      // 64KB
    .constant global MAX_PROCESSES: byte = 32;

    type process = struct {
      id: byte;
      parent_id: byte;  // 0 means no parent
      task: * scheduler::task;
      table: * memory::table;
    };

    global processes: std::vector<* process> = null;

    // Error handler - called by trampoline which handles stack switching and INT return.
    .export function _error_interrupt(): void {
      log("process: error interrupt!");

      // For now, just kill the current process.
      var process = current_process();
      destroy_process(process);

      // When we return from here, we'll be returning to
      // a *different* task.
      return;
    }

    function create_process(binary: byte[], parent_id: byte, args: byte[], args_len: byte): byte {
      log("process: create_process start");

      // Check process limit
      if(len processes >= MAX_PROCESSES){
        log("process: max processes reached");
        return 0;
      }

      // Allocate a new virtual memory table for our new process.
      //
      // TODO: parse out sizing information from the binary header?
      var executable_base = DEFAULT_EXECUTABLE_BASE;
      var executable_size = DEFAULT_EXECUTABLE_SIZE;
      var heap_size = DEFAULT_HEAP_SIZE;
      var stack_size = DEFAULT_STACK_SIZE;

      log("process: creating table");
      var table = memory::create_table(executable_base, executable_size, heap_size, stack_size);
      if(!table){
        log("process: failed to create memory table");
        return 0;
      }

      // Create a task. We start execution at the executable base (0x1000),
      // just like the VM does.  We initialize all registers to 0x0 except
      // the QLLC stack pointer, which initialize to the top of the stack.
      log("process: creating task");
      var task = scheduler::create_task();
      log("process: setting task ip");
      task->state.ip = executable_base;
      // Stack pointer uses virtual address (must match create_table's layout)
      var heap_base = executable_base + executable_size + 0x1000;
      var stack_base = heap_base + heap_size + 0x1000;
      log("process: setting task sp");
      var sp = stack_base + stack_size;

      // Copy args to the top of the stack and pass via callee-save registers.
      // Args data is placed at the top of the stack (highest addresses).
      // r32 = pointer to args data (virtual address), r33 = args length
      // SP is set below the args data.
      var stack_page = memory::table_page(table, 2);
      var stack_phys = <unsafe * byte>(<byte>stack_page->physical_address);
      if (args_len > 0) {
        log("process: copying args to stack");

        // Args data at top of stack: offset = stack_size - args_len
        var args_data_offset = stack_size - args_len;

        // Copy args data to physical memory
        var args_dest = <unsafe * byte>(<unsafe byte>stack_phys + args_data_offset);
        for (var j: byte = 0; j < args_len; j = j + 1) {
          args_dest[unsafe j] = args[j];
        }

        // Set r32 = virtual address of args data
        task->state.registers[32] = stack_base + args_data_offset;
        // Set r33 = args length
        task->state.registers[33] = args_len;
        // SP points below the args data
        sp = stack_base + args_data_offset;
        log("process: args setup complete");
      } else {
        log("process: no args");
        // No args: r32 = 0 (null pointer), r33 = 0 (zero length)
        task->state.registers[32] = 0;
        task->state.registers[33] = 0;
        // SP stays at top of stack
      }

      task->state.registers[63] = sp;
      // Set the task's page table for context switching
      task->table = table;

      // Create a process.
      log("process: creating process struct");
      var process = new process = process {
        id = task->id,
        parent_id = parent_id,
        task = task,
        table = table,
      };

      std::vector::add(&processes, process);

      // Copy the binary into memory (page index 0 is the executable section).
      var exec_page = memory::table_page(table, 0);
      var dest = <unsafe * byte>(<byte>exec_page->physical_address);
      var src = &binary[0];

      for(var i = 0; i < len binary; i = i + 1){
        dest[unsafe i] = src[unsafe i];
      }

      // Add the task to the task queue.
      log("process: enqueuing task");
      scheduler::enqueue_task(process->task);

      log("process: created process");
      return process->id;
    }

    function _kill_children(parent_id: byte): void {
      // Find all children of this process and kill them recursively
      var i = 0;
      while(i < len processes){
        if(processes[i]->parent_id == parent_id){
          destroy_process(processes[i]);
          // Restart loop since we modified the vector
          i = 0;
        }
        else {
          i = i + 1;
        }
      }
    }

    function destroy_process(process: * process): void {
      if(!process){
        panic("process: invalid process");
      }

      log("process: destroying process");

      // Release display if this process owns it
      syscall::release_display(process->id);

      // First kill all children recursively
      _kill_children(process->id);

      var i = std::vector::find(processes, process);
      if(i == -1){
        panic("process: unknown process");
      }
      std::vector::remove(processes, i);

      memory::destroy_table(process->table);
      scheduler::destroy_task(process->task);
      delete process;
    }

    function _find_process(process: * process, t: * scheduler::task): bool {
      return process->task == t;
    }

    function current_process(): * process {
      // Find the current process.
      var i = std::vector::find_by(processes, _find_process, scheduler::current_task);
      if(i == -1){
        panic("process: current_process: current process not found");
      }
      return processes[i];
    }

    function init(): void {
      log("process: initializing...");

      // Create an empty process table.
      processes = std::vector::create<* process>(MAX_PROCESSES);

      // Register error handler.
      // Use trampoline which switches to kernel stack before calling handler.
      support::interrupt(interrupts::ERROR, support::error_trampoline);

      log("process: initialized");
    }
  }
}