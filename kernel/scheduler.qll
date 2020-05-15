namespace kernel {
  namespace scheduler {
    type task = struct {
      id: byte;
      killed: bool;
      state: interrupts::state;
      next: * task;
    };

    global current_task: * task = null;
    global tasks: * task = null;

    function _restore_current_task(): void {
      *state = current_task->state;
      memory::use_table(current_task->table);
    }

    // This function will be called by the timer interrupt handler.
    // Its argument will be a pointer to the current values of all registers.
    function _schedule_task(state: * interrupts::state): void {
      log('scheduler: scheduling...');

      // Invalid state.
      if(!current_task || !tasks){
        panic('scheduler: no tasks!');
      }

      // Already running the only task.
      if(tasks == current_task && !current_task->next){
        log('scheduler: already running only task');
        return;
      }

      // Save the current task's state.
      current_task->state = *state;

      // Schedule the next task; loop around to the beginning.
      current_task = current_task->next;
      if(!current_task){
        current_task = tasks;
      }

      // Restore the next task's state.
      restore_current_task(state);
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

    function enqueue_task(task: * task): bool {
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
      var next_task = task->next || tasks;

      std::ilist::remove(&tasks, task);
      delete task;

      // Now we need to schedule a different task,
      // otherwise when we may return to the one we just
      // destroyed if this was called in an interrupt
      //  handler.
      if(destroyed_current_task){
        current_task = next_task;
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
      tasks = task;
      current_task = task;

      // Configure hardware timer interrupt handler.
      support::interrupt(interrupts::TIMER, _timer_interrupt);
      *peripherals::timer = 100;
    }
  }
}
