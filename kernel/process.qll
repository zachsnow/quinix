namespace kernel {
  namespace process {
    type process = struct {
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

    function create_process(binary: byte[]): bool {
      // Allocate a new virtual memory table for our new process.
      //
      // TODO: parse out sizing information from the binary header?
      var executable_base = 0x1000;
      var executable_size: byte = 0x1000;
      var heap_size: byte = 0x8000;
      var stack_size: byte = 0x1000;

      var table = memory::create_table(executable_base, executable_size, heap_size, stack_size);

      // Create a task. We start execution at the executable base (0x1000),
      // just like the VM does.  We initialize all registers to 0x0 except
      // the QLLC stack pointer, which initialize to the top of the stack.
      var task = scheduler::create_task();
      task->ip = executable_base;
      task->registers[63] = table->pages[2].physical_address + table->pages[2].size;

      // Create a process.
      var process = new process = process {
        task = task,
        table = table,
        files = fs::create_files(),
      };

      std::vector::add(&processes, process);

      // Copy the binary into memory.
      std::unsafe_copy(
        <unsafe * byte>(<byte>table->pages[0].physical_address),
        &binary[0],
        len binary,
      );

      // Add the task to the task queue.
      scheduler::enqueue_task(process->task);

      return true;
    }

    function destroy_process(process: * process): void {
      if(!process){
        panic('process: invalid process');
      }
      if(!std::vector::remove(processes, process)){
        panic('process: unknown process');
      }

      memory::destroy_table(process->table);
      scheduler::destroy_task(process->task);
      fs::destroy_files(process->files);
      delete process;
    }

    function _find_process(p: * process, t: task): bool {
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
      // Create an empty process table.
      processes = std::vector::create<* process>(10);

      // Register error handler.
      support::interrupt(interrupts::ERROR, _error_interrupt);
    }
  }
}