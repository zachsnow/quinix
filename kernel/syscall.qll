namespace kernel::syscall {
  // interrupt 0x80 handler; special calling convention `interrupt`.
  .interrupt function syscall(syscall: byte): byte {
    if(syscall >= len syscalls){
      return -1;
    }
    var entry = syscalls[syscall];
    return entry();
  }

  global syscalls: syscall[] = [
    exit,
    debugger,
    open,
    close,
    read,
    write,
  ];

  function read(buffer: * byte, size: byte, destination: * handle): errors::error {
    var destination: * byte = translate_address(destination);
    var destination_end: * byte = translate_address_offset(destination, size);

    var source: * byte = translate_handle(handle);
    var source_end: * byte = translate_handle_end(handle);



  }

  function write(): errors::error {
    if(!validate_pointer(buffer)){
      return errors::INVALID_POINTER;
    }
    if(!validate_pointer_offset(buffer, size)){
      return errors::INVALID_POINTER;
    }

    //

  }

  function init(): void {
    // Register `syscall` to handle interrupt 0x80.
    support::interrupt(syscall, 0x80);
  }
}
