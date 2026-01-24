namespace kernel {
  namespace process {
    // Configuration
    .constant global DEFAULT_EXECUTABLE_BASE: byte = 0x1000;
    .constant global DEFAULT_EXECUTABLE_SIZE: byte = 0x1000;  // 4KB
    .constant global DEFAULT_HEAP_SIZE: byte = 0x8000;        // 32KB
    .constant global DEFAULT_STACK_SIZE: byte = 0x1000;       // 4KB
    .constant global MAX_PROCESSES: byte = 32;

    type process = struct {
      id: byte;
      parent_id: byte;  // 0 means no parent
      task: * scheduler::task;
      table: * memory::table;
      files: fs::files;
    };

    global processes: std::vector<* process> = null;

    .interrupt function _error_interrupt(): void {
      // For now, just kill the current process.
      var process = current_process();
      destroy_process(process);

      // When we return from here, we'll be returning to
      // a *different* task.
      return;
    }

    function create_process(binary: byte[], parent_id: byte): byte {
      // Check process limit
      if(len processes >= MAX_PROCESSES){
        log('process: max processes reached');
        return 0;
      }

      // Allocate a new virtual memory table for our new process.
      //
      // TODO: parse out sizing information from the binary header?
      var executable_base = DEFAULT_EXECUTABLE_BASE;
      var executable_size = DEFAULT_EXECUTABLE_SIZE;
      var heap_size = DEFAULT_HEAP_SIZE;
      var stack_size = DEFAULT_STACK_SIZE;

      var table = memory::create_table(executable_base, executable_size, heap_size, stack_size);
      if(!table){
        log('process: failed to create memory table');
        return 0;
      }

      // Create a task. We start execution at the executable base (0x1000),
      // just like the VM does.  We initialize all registers to 0x0 except
      // the QLLC stack pointer, which initialize to the top of the stack.
      var task = scheduler::create_task();
      task->state.ip = executable_base;
      // Stack is page index 2: set stack pointer to top of stack
      var stack_page = memory::table_page(table, 2);
      task->state.registers[63] = stack_page->physical_address + stack_page->size;
      // Set the task's page table for context switching
      task->table = table;

      // Create a process.
      var process = new process = process {
        id = task->id,
        parent_id = parent_id,
        task = task,
        table = table,
        files = fs::create_files(),
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
      scheduler::enqueue_task(process->task);

      log('process: created process');
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
        panic('process: invalid process');
      }

      log('process: destroying process');

      // First kill all children recursively
      _kill_children(process->id);

      var i = std::vector::find(processes, process);
      if(i == -1){
        panic('process: unknown process');
      }
      std::vector::remove(processes, i);

      memory::destroy_table(process->table);
      scheduler::destroy_task(process->task);
      fs::destroy_files(process->files);
      delete process;
    }

    function _find_process(process: * process, t: * scheduler::task): bool {
      return process->task == t;
    }

    function current_process(): * process {
      // Find the current process.
      var i = std::vector::find_by(processes, _find_process, scheduler::current_task);
      if(i == -1){
        panic('process: current_process: current process not found');
      }
      return processes[i];
    }

    function init(): void {
      log('process: initializing...');

      // Create an empty process table.
      processes = std::vector::create<* process>(MAX_PROCESSES);

      // Register error handler.
      support::interrupt(interrupts::ERROR, _error_interrupt);

      log('process: initialized');
    }
  }
}