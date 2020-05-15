///////////////////////////////////////////////////////////////////////
// The Quinix standard library OS interface. The idea is that
// `std.qll` will implement most of the library and then this
// will connect it to the OS via syscalls.
//
// Since there's no operating system yet, this is just a sketch.
///////////////////////////////////////////////////////////////////////
namespace lib {
  namespace support {
    .constant global EXIT_SYSCALL: byte = 0x0;
    .constant global OPEN_SYSCALL: byte = 0x1;
    .constant global CLOSE_SYSCALL: byte = 0x2;
    .constant global READ_SYSCALL: byte = 0x3;
    .constant global WRITE_SYSCALL: byte = 0x4;

    function syscall(syscall: byte): byte;
    function syscall1(syscall: byte, arg0: byte): byte;
    function syscall2(syscall: byte, arg0: byte, arg1: byte): byte;

    function debugger(): void;
  }

  type error = byte;
  namespace error {
    .constant global GENERIC_ERROR: error = -1;
  }

  type handle = byte;
  namespace handle {
    .constant global input: handle = 0x1;
    .constant global output: handle = 0x2;
  }

  function open(filename: string): handle {
    return <handle>support::syscall1(support::OPEN_SYSCALL, <unsafe byte>filename);
  }

  function close(handle: handle): error {
    return <error>support::syscall1(support::CLOSE_SYSCALL, <byte>handle);
  }

  function read(handle: handle, buffer: string): error {
    return <error>support::syscall2(support::READ_SYSCALL, <byte>handle, <unsafe byte>buffer);
  }

  function write(handle: handle, data: string): error {
    return <error>support::syscall2(support::WRITE_SYSCALL, <byte>handle, <unsafe byte>data);
  }

  function input(buffer: string): error {
    return read(debug_input_handle, buffer);
  }

  function print(text: string): error {
    return write(debug_output_handle, text);
  }

  function debugger(): void {
    support::debugger();
  }

  function exit(code: byte): void {
    support::syscall1(support::EXIT_SYSCALL, code);
  }

  function create(binary: string): error {
    return supprt::syscall1(binary);
  }
}
