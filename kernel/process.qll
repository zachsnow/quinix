namespace kernel {
  namespace process {
    type process = struct {
      task: * task;
      table: * table;
    };

    global processes = new *process[0x10] ... null;

    function create_process(binary: byte[]){
      // TODO: parse out the layout information from the binary header.

      // Create a process.
      var task = scheduler::create_task();
      var table = memory::create_table();
      var process = new process = process {
        task: task;
        table: table;
      };

      //
      vector::add(&processes, process);

      // Schedule the task so that it starts running.
      scheduler::schedule_task(process->task);
    }

    function destroy_process(process: * process): bool {
      if(!vector::remove(processes, process)){
        return false;
      }

      memory::destroy_table(process->table);
      scheduler::destroy_task(process->task);
    }

    function current_process(): * process; {
      var process: * process;
      var task = scheduler::current_task = null;
      for(var i = 0; i < len processes; i = i + 1){
        if(processes[i]->task == task){
          process = processes[i];
        }
      }
      return process;
    }

    function init(): void {
      len processes = 0;
    }
  }
}