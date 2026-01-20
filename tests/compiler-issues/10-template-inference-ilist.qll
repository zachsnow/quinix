// Issue #10: Template Inference for Intrusive Lists
//
// Expected: Template inference should work for intrusive list operations
// Solution: Change remove<T>(ilist: T, el: T) to remove<T>(ilist: *T, el: T)
//           to match add<T>(ilist: *T, el: T) signature

namespace std {
  namespace ilist {
    function add<T>(ilist: *T, el: T): bool {
      if(!ilist){
        return false;
      }

      var head = *ilist;
      if(!head){
        *ilist = el;
        return true;
      }

      while(head->next){
        head = head->next;
      }
      head->next = el;
      return true;
    }

    function remove<T>(ilist: *T, el: T): void {
      if(!ilist || !*ilist){
        return;
      }

      // If removing the head
      if(*ilist == el){
        *ilist = (*ilist)->next;
        return;
      }

      // Otherwise traverse to find the element
      var prev = *ilist;
      while(prev->next){
        if(prev->next == el){
          prev->next = el->next;
          return;
        }
        prev = prev->next;
      }
    }

    function length<T>(ilist: T): byte {
      var i = 0;
      for(var p = ilist; !!p; p = p->next){
        i = i + 1;
      }
      return i;
    }
  }
}

type task = struct {
  next: * task;
  id: byte;
};

function test_add_and_remove(): byte {
  var tasks: * task = null;
  
  // Create some tasks
  var t1: * task = new task;
  t1->id = 1;
  t1->next = null;
  
  var t2: * task = new task;
  t2->id = 2;
  t2->next = null;
  
  var t3: * task = new task;
  t3->id = 3;
  t3->next = null;
  
  // Add tasks - template inference works!
  std::ilist::add(&tasks, t1);
  std::ilist::add(&tasks, t2);
  std::ilist::add(&tasks, t3);
  
  // Verify length
  if (std::ilist::length(tasks) != 3) {
    return 1;
  }
  
  // Verify order (t1, t2, t3)
  if (tasks->id != 1) {
    return 2;
  }
  if (tasks->next->id != 2) {
    return 3;
  }
  if (tasks->next->next->id != 3) {
    return 4;
  }
  
  // Remove middle element - template inference works!
  std::ilist::remove(&tasks, t2);
  
  // Verify length
  if (std::ilist::length(tasks) != 2) {
    return 5;
  }
  
  // Verify t2 is gone
  if (tasks->id != 1) {
    return 6;
  }
  if (tasks->next->id != 3) {
    return 7;
  }
  
  // Remove head - template inference works!
  std::ilist::remove(&tasks, t1);
  
  // Verify length
  if (std::ilist::length(tasks) != 1) {
    return 8;
  }
  
  // Verify only t3 remains
  if (tasks->id != 3) {
    return 9;
  }
  if (tasks->next != null) {
    return 10;
  }
  
  // Remove last element
  std::ilist::remove(&tasks, t3);
  
  // Verify empty
  if (tasks != null) {
    return 11;
  }
  
  // Cleanup
  delete t1;
  delete t2;
  delete t3;
  
  return 0;
}

function main(): byte {
  return test_add_and_remove();
}
