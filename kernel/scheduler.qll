namespace scheduler {
  type state = struct {
    generic: byte[64];
    ip: byte;
  };

  type task = struct {
    id: byte;
    current_state: state;
    next: * task;
  };

  global current_task: * task;
  global tasks: task[];

  // This function will be called by the timer interrupt handler.
  // Its argument will be a pointer to the current values of all registers.
  function schedule_task(state: * state): void {
    // Invalid state.
    if(!current_task || !tasks){
      panic();
    }

    // Already running the only task.
    if(tasks == current_task && !current_task->next){
      return;
    }

    // Save the current task's state.
    current_task->state = state;

    // Schedule the next task.
    current_task = current_task->next;
    if(!current_task){
      current_task = tasks;
    }

    // Restore the next task's state.
    *state = current_task->state;
  }

  global id: byte = 0;

  function create_task(): * task {
    var task: task = new task;
    task.id = id;
    id += 1;
    return task;
  }

  function destroy_element<T>(list: * T, el: * T){
    delete el;
  }

  function destroy_task(task: * task) {
    destroy_element<task>(tasks, task);
  }

  function init(){
    // Create task 0. When we receive our first
    // request to schedule a task, this is the task
    // that we'll record as having been currently running.
    var task: * task = create_task();
    task.id = 0
    tasks = task;

  }
}
