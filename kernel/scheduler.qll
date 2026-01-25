namespace kernel {
  namespace scheduler {
    type task = struct {
      id: byte;
      killed: bool;
      state: interrupts::state;
      table: * memory::table;
      next: * task;
    };

    global current_task: * task = null;
    global tasks: * task = null;

    function _restore_current_task(): void {
      *interrupts::state = current_task->state;
      memory::use_table(current_task->table);
    }

    // This function will be called by the timer interrupt handler.
    // Its argument will be a pointer to the current values of all registers.
    function _schedule_task(state: * interrupts::state): void {
      // Invalid state.
      if(!current_task || !tasks){
        panic('scheduler: no tasks!');
      }

      // Already running the only task.
      if(tasks == current_task && !current_task->next){
        return;
      }

      // Save the current task's state.
      current_task->state = *state;

      // Schedule the next task; loop around to the beginning.
      // Skip task 0 (kernel) since it has no page table and can't run with MMU.
      current_task = current_task->next;
      if(!current_task){
        current_task = tasks;
      }
      // Skip kernel task (id 0 which has no page table)
      if(current_task->id == 0){
        current_task = current_task->next;
        if(!current_task){
          current_task = tasks;
        }
      }

      // If we're back to task 0, no user tasks left to run
      if(current_task->id == 0){
        return;
      }

      // Restore the next task's state.
      _restore_current_task();
    }

    .interrupt function _timer_interrupt(): void {
      _schedule_task(interrupts::state);
    }

    global id: byte = 0;

    function create_task(): * task {
      var task = new task;
      task->id = id;
      id = id + 1;
      return task;
    }

    function enqueue_task(task: * task): void {
      task->next = tasks;
      tasks = task;
    }

    function destroy_task(task: * task): void {
      if(!task){
        panic('scheduler: destroy: no task');
      }
      if(task->id == 0){
        panic('scheduler: destroy: destroying PID 0');
      }

      var destroyed_current_task = task == current_task;

      std::ilist::remove(&tasks, task);
      delete task;

      // If we destroyed the current task, switch to the head of the task list.
      if(destroyed_current_task){
        if(!tasks){
          panic('scheduler: no tasks after destroy');
        }
        current_task = tasks;
        // If we're switching to the kernel task (no page table), halt instead
        // because the kernel can't run with MMU enabled and no valid page table.
        if(!current_task->table){
          log('All user tasks completed');
          support::halt(0);
        }
        *interrupts::state = current_task->state;
        memory::use_table(current_task->table);
      }
    }

    function init(): void {
      log('scheduler: initializing...');

      // Create task 0. When we receive our first
      // request to schedule a task, this is the task
      // that we'll record as having been currently running.
      var task: * task = create_task();
      task->next = null;  // Explicitly initialize to null
      task->table = null;
      tasks = task;
      current_task = task;

      // Configure hardware timer interrupt handler.
      support::interrupt(interrupts::TIMER, _timer_interrupt);
      *peripherals::timer = 500;  // Timer interval for preemption (ms)
    }
  }
}
