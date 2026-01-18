namespace kernel {
  namespace syscall {
    .constant global EXIT: byte = 0x0;
    .constant global READ: byte = 0x1;
    .constant global WRITE: byte = 0x2;
    .constant global OPEN: byte = 0x3;
    .constant global CLOSE: byte = 0x4;
    .constant global CREATE: byte = 0x5;
    .constant global DESTROY: byte = 0x6;
    .constant global SPAWN: byte = 0x7;

    type syscall = struct {
      syscall: byte;
      arg0: byte;
      arg1: byte;
      arg2: byte;
    };

    // interrupt 0x80 handler.
    .interrupt function _syscall_interrupt(): byte {
      log('syscall: interrupt');

      // Arguments are passed in r0...r3.
      var syscall = syscall {
        syscall = interrupts::state->registers[0],
        arg0 = interrupts::state->registers[1],
        arg1 = interrupts::state->registers[2],
        arg2 = interrupts::state->registers[3],
      };

      // For now if we make an invalid syscall, we just exit.
      if(syscall.syscall < 0 || syscall.syscall >= len syscalls){
        log('syscall: invalid syscall');
        _exit(syscall);
        return 0;
      }

      var fn = syscalls[syscall.syscall];
      return fn(syscall);
    }

    global syscalls: syscall[] = [
      _exit,
      _read,
      _write,
      _open,
      _close,
      _create,
      _destroy,
      _spawn,
    ];

    function _translate_pointer<T>(p: * byte): * T {
      var current_process = process::current_process();
      return <unsafe * T>memory::translate(current_process->table, p);
    }

    function _translate_array<T>(p: * byte): T {
      var current_process = process::current_process();
      return <unsafe T>memory::translate(current_process->table, p);
    }

    function _validate_pointer(p: * byte): bool {
      var current = process::current_process();
      return memory::translate(current->table, p) != null;
    }

    function _validate_array<T>(p: * byte): bool {
      if(!_validate_pointer(p)){
        return false;
      }
      var arr = <unsafe T[]>p;
      var arr_cap = cap arr;
      return _validate_pointer(<unsafe byte>p + arr_cap);
    }

    function _exit(sc: syscall): byte {
      var process = process::current_process();
      process::destroy_process(process);
      return 0;
    }

    function _write(sc: syscall): byte {
      var handle = <unsafe fs::handle>sc.arg0;

      if(!_validate_array<byte[]>(<unsafe * byte>sc.arg1)){
        return 0;
      }
      var data = _translate_array<byte[]>(<unsafe * byte>sc.arg1);

      return fs::write(handle, data);
    }

    function _read(sc: syscall): byte {
      var handle = <unsafe fs::handle>sc.arg0;

      if(!_validate_array<byte[]>(<unsafe * byte>sc.arg1)){
        return 0;
      }
      var data = _translate_array<byte[]>(<unsafe * byte>sc.arg1);

      return fs::read(handle, data);
    }

    function _open(sc: syscall): byte {
      // TODO: implement
      return 0;
    }

    function _close(sc: syscall): byte {
      // TODO: implement
      return 0;
    }

    function _create(sc: syscall): byte {
      // TODO: implement
      return 0;
    }

    function _destroy(sc: syscall): byte {
      // TODO: implement
      return 0;
    }

    function _spawn(sc: syscall): byte {
      if(!_validate_array<byte[]>(<unsafe * byte>sc.arg0)){
        return 0;
      }
      var path = _translate_array<byte[]>(<unsafe * byte>sc.arg0);
      // TODO: load binary from filesystem using path
      // For now, just return 0 (not implemented)
      return 0;
    }

    function init(): void {
      // Register `syscall` to handle interrupt 0x80.
      support::interrupt(interrupts::SYSCALL, _syscall_interrupt);
    }
  }
}