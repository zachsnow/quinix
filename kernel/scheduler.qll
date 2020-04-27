namespace kernel {
  namespace scheduler {
    .constant global TIMER: byte = 0x2;

    type state = struct {
      registers: byte[64];
      ip: byte;
    };

    type task = struct {
      id: byte;
      state: state;
      next: * task;
    };

    global current_task: * task = null;
    global tasks: * task = null;

    // This function will be called by the timer interrupt handler.
    // Its argument will be a pointer to the current values of all registers.
    function schedule_task(state: * state): void {
      log('scheduler: scheduling...\n');

      // Invalid state.
      if(!current_task || !tasks){
        panic('scheduler: no tasks!\n');
      }

      // Already running the only task.
      if(tasks == current_task && !current_task->next){
        log('scheduler: already running only task\n');
        return;
      }

      // Save the current task's state.
      current_task->state = *state;

      // Schedule the next task.
      current_task = current_task->next;
      if(!current_task){
        current_task = tasks;
      }

      // Restore the next task's state.
      *state = current_task->state;
    }

    .interrupt function _timer_interrupt(): void {
      schedule_task(<unsafe * state>0x2);
    }

    global id: byte = 0;

    function create_task(): * task {
      var task = new task;
      task->id = id;
      id = id + 1;
      return task;
    }

    function init(): void {
      log('scheduler: initializing...\n');

      // Create task 0. When we receive our first
      // request to schedule a task, this is the task
      // that we'll record as having been currently running.
      var task: * task = create_task();
      tasks = task;
      current_task = task;

      // Configure hardware timer interrupt handler.
      support::interrupt(0x2, _timer_interrupt);
      var timerControl = <unsafe * byte>0x300;
      *timerControl = 100;
    }
  }
}
