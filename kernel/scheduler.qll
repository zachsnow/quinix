namespace kernel {
  namespace scheduler {
    .constant global TIMER: byte = 0x2;

    type state = struct {
      registers: byte[64];
      ip: byte;
    };

    global interrupt_state: * state = <unsafe * state>0x2;

    type task = struct {
      id: byte;
      killed: bool;
      state: state;
      next: * task;
    };

    global current_task: * task = null;
    global tasks: * task = null;

    // This function will be called by the timer interrupt handler.
    // Its argument will be a pointer to the current values of all registers.
    function schedule_task(state: * state): void {
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
      *state = current_task->state;
    }

    .interrupt function _timer_interrupt(): void {
      schedule_task(interrupt_state);
    }

    global id: byte = 0;

    function create_task(): * task {
      var task = new task;
      task->id = id;
      id = id + 1;
      return task;
    }

    function destroy_task(task: * task): void {

      // Excise passed task.
      if(task === tasks){
        tasks = task->next;
      }
      else {
        var previous_task = tasks;
        while(previous_task){
          if(previous_task->next == task){
            break;
          }
          previous_task = previous_task->next;
        }
        if(!previous_task){

        }
      }
      while(t){
        if(t == task)
      }
      // Schedule next task so that we don't try to return to this task.
      *interrupt_state = next_task->state;
    }

    function schedule_task(task: * task): bool {
      task->next = tasks;
      tasks = task;
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
      support::interrupt(0x2, _timer_interrupt);
      *peripherals::timer = 100;
    }
  }
}
