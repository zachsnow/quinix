///////////////////////////////////////////////////////////////////////
// The Quinix standard library.
//
// NOTE: there's no operating system yet, so this is just a sketch.
///////////////////////////////////////////////////////////////////////
namespace lib {
  namespace support {
    .constant global EXIT_SYSCALL: byte = 0x0;
    .constant global DEBUGGER_SYSCALL: byte = 0x1;
    .constant global OPEN_SYSCALL: byte = 0x2;
    .constant global CLOSE_SYSCALL: byte = 0x3;
    .constant global READ_SYSCALL: byte = 0x4;
    .constant global WRITE_SYSCALL: byte = 0x5;

    function syscall(syscall: byte): byte;
    function syscall1(syscall: byte, arg0: byte): byte;
    function syscall2(syscall: byte, arg0: byte, arg1: byte): byte;
  }

  type error = byte;
  .constant global GENERIC_ERROR: error = -1;

  type string = byte[];

  type handle = * byte;

  global debug_input_handle: .constant handle = <unsafe handle>0x1;
  global debug_output_handle: .constant handle = <unsafe handle>0x2;

  function open(filename: string): handle {
    return <unsafe handle>support::syscall1(support::OPEN_SYSCALL, <unsafe byte>filename);
  }

  function close(handle: handle): error {
    return <error>support::syscall1(support::CLOSE_SYSCALL, <unsafe byte>handle);
  }

  function read(handle: handle, buffer: string): error {
    return <error>support::syscall2(support::READ_SYSCALL, <unsafe byte>handle, <unsafe byte>buffer);
  }

  function write(handle: handle, data: string): error {
    return <error>support::syscall2(support::WRITE_SYSCALL, <unsafe byte>handle, <unsafe byte>data);
  }

  function input(buffer: string): error {
    return read(debug_input_handle, buffer);
  }

  function output(text: string): error {
    return write(debug_output_handle, text);
  }

  function debugger(): void {
    support::syscall(support::DEBUGGER_SYSCALL);
  }

  function exit(code: byte): void {
    support::syscall1(support::EXIT_SYSCALL, code);
  }
}
