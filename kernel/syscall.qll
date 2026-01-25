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

    // Syscall handler function type
    type handler = (syscall) => byte;

    // interrupt 0x80 handler.
    .interrupt function _syscall_interrupt(): void {
      // Arguments are passed in r0...r3.
      var sc = syscall {
        syscall = interrupts::state->registers[0],
        arg0 = interrupts::state->registers[1],
        arg1 = interrupts::state->registers[2],
        arg2 = interrupts::state->registers[3],
      };

      // For now if we make an invalid syscall, we just exit.
      if(sc.syscall < 0 || sc.syscall >= len syscalls){
        log('syscall: invalid');
        _exit(sc);
        return;
      }

      var fn = syscalls[sc.syscall];
      var result = fn(sc);
      // Put result in r0 for return to user
      interrupts::state->registers[0] = result;
    }

    global syscalls: handler[] = [
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

    // Translate a user virtual address to physical
    function _translate(p: * byte): * byte {
      var current = process::current_process();
      return memory::translate(current->table, p);
    }

    // Get the data pointer from a user-space slice (translated to physical)
    function _get_slice_data(slice_addr: * byte): * byte {
      var physical_slice = _translate(slice_addr);
      if(!physical_slice){
        return null;
      }
      var data_virt = physical_slice[unsafe 0];  // Virtual address of data
      return _translate(<unsafe * byte>data_virt);
    }

    // Get the length from a user-space slice
    function _get_slice_len(slice_addr: * byte): byte {
      var physical_slice = _translate(slice_addr);
      if(!physical_slice){
        return 0;
      }
      return physical_slice[unsafe 1];  // Length field
    }

    function _validate_pointer(p: * byte): bool {
      return _translate(p) != null;
    }

    function _validate_slice(p: * byte): bool {
      var result = _get_slice_data(p) != null;
      return result;
    }

    function _exit(sc: syscall): byte {
      log('syscall: exit');
      var process = process::current_process();
      process::destroy_process(process);
      return 0;
    }

    function _write(sc: syscall): byte {
      var handle = <fs::handle>sc.arg0;
      var slice_addr = <unsafe * byte>sc.arg1;

      if(!_validate_slice(slice_addr)){
        log('syscall: write: invalid slice');
        return 0;
      }

      var data_ptr = _get_slice_data(slice_addr);
      var data_len = _get_slice_len(slice_addr);

      // Write data byte by byte through the filesystem
      for(var i = 0; i < data_len; i = i + 1){
        var ch = data_ptr[unsafe i];
        fs::write_byte(handle, ch);
      }

      return 1;
    }

    function _read(sc: syscall): byte {
      var handle = <fs::handle>sc.arg0;
      var slice_addr = <unsafe * byte>sc.arg1;

      if(!_validate_slice(slice_addr)){
        return 0;
      }

      // For now, read is not implemented
      // TODO: implement proper read syscall
      return 0;
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
      // TODO: implement spawn syscall
      // For now, just return 0 (not implemented)
      return 0;
    }

    function init(): void {
      log('syscall: initializing...');
      // Register `syscall` to handle interrupt 0x80.
      support::interrupt(interrupts::SYSCALL, _syscall_interrupt);
      log('syscall: initialized');
    }
  }
}