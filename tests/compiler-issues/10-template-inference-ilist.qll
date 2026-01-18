// Issue #10: Template Inference for Intrusive Lists
//
// Expected: Should infer T = * task from arguments
// Actual: Error - unable to infer template instantiation

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

    function remove<T>(ilist: T, el: T): void {
      if(!ilist){
        return;
      }
      // TODO: implement removal
    }
  }
}

type task = struct {
  id: byte;
  next: * task;
};

global tasks: * task = null;

function test(): byte {
  var t1 = new task = task { id = 1, next = null };
  var t2 = new task = task { id = 2, next = null };

  std::ilist::add(&tasks, t1);
  std::ilist::add(&tasks, t2);

  // This should infer T = * task but fails
  std::ilist::remove(&tasks, t1);  // ERROR: unable to infer template instantiation

  return 0;
}

function main(): byte {
  return test();
}
