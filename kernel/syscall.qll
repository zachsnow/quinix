namespace kernel {
  namespace syscall {
    .constant global EXIT: byte = 0x0;
    .constant

    // interrupt 0x80 handler; special calling convention `interrupt`.
    .interrupt function syscall(syscall: byte, arg0: byte, arg1: byte, arg2: byte): byte {
      if(syscall == EXIT){
        _exit();
        return;
      }
    }

    global syscalls: syscall[] = [
      _exit,
      _debugger,
      _open,
      _close,
      _read,
      _write,
    ];

    function translate_pointer(p: * byte): * byte {
      // Get the current task and check if the pointer
      // is valid within the task's memory table. If so,
      // convert it to physical memory.
      var current_process = process::current_process();
      if(!current_process){
        kernel::panic('syscall: invalid process');
      }
      return memory::translate(current_process->table, p);
    }

    function translate_array(a: byte[]): byte[] {
      return <unsafe byte[]>translate_pointer(<unsafe * byte>a);
    }

    function validate_handle(handle: handle): bool {
      var current_process = process::current_process();
    }

    function _read(handle: handle, buffer: byte[]): error {
      if(!validate_handle(handle)){
        return error::INVALID_HANDLE;
      }

      buffer = convert_array(buffer);
      if(!buffer){
        return error::INVALID_POINTER;
      }
      std::buffered::read(buffer,)
      return error::OK;
    }

    function _write(): errors::error {
      if(!validate_pointer(buffer)){
        return errors::INVALID_POINTER;
      }
      if(!validate_pointer_offset(buffer, size)){
        return errors::INVALID_POINTER;
      }

      //

    }

    function _exit(): void {
      var process = process::current_process();
      if(!process){
        kernel::panic('syscall: invalid process');
      }
      process::destroy_process(process);
    }

    function init(): void {
      // Register `syscall` to handle interrupt 0x80.
      support::interrupt(syscall, 0x80);
    }
  }
}