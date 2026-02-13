///////////////////////////////////////////////////////////////////////
// The Quinix standard library OS interface. The idea is that
// `std.qll` will implement most of the library and then this
// will connect it to the OS via syscalls.
///////////////////////////////////////////////////////////////////////
namespace lib {
  namespace support {
    .constant global EXIT_SYSCALL: byte = 0x0;
    .constant global READ_SYSCALL: byte = 0x1;
    .constant global WRITE_SYSCALL: byte = 0x2;
    .constant global OPEN_SYSCALL: byte = 0x3;
    .constant global CLOSE_SYSCALL: byte = 0x4;
    .constant global CREATE_SYSCALL: byte = 0x5;
    .constant global DESTROY_SYSCALL: byte = 0x6;
    .constant global SPAWN_SYSCALL: byte = 0x7;
    .constant global YIELD_SYSCALL: byte = 0x8;
    .constant global DISPLAY_OPEN_SYSCALL: byte = 0x9;
    .constant global DISPLAY_FLIP_SYSCALL: byte = 0xA;
    .constant global DISPLAY_CLOSE_SYSCALL: byte = 0xB;
    .constant global KEY_STATE_SYSCALL: byte = 0xC;

    function syscall(syscall: byte): byte;
    function syscall1(syscall: byte, arg0: byte): byte;
    function syscall2(syscall: byte, arg0: byte, arg1: byte): byte;
    function syscall3(syscall: byte, arg0: byte, arg1: byte, arg2: byte): byte;

    function debugger(): void;
  }

  type error = byte;
  namespace error {
    .constant global GENERIC_ERROR: error = -1;
  }

  type handle = byte;
  namespace handle {
    .constant global input: handle = 0x2;
    .constant global output: handle = 0x1;
  }

  function open(filename: string): handle {
    return <handle>support::syscall1(support::OPEN_SYSCALL, <unsafe byte>filename);
  }

  function close(handle: handle): error {
    return <error>support::syscall1(support::CLOSE_SYSCALL, <byte>handle);
  }

  function read(handle: handle, buffer: string): error {
    // Pass address of the slice structure, not just the data pointer
    return <error>support::syscall2(support::READ_SYSCALL, <byte>handle, <unsafe byte>&buffer);
  }

  function write(handle: handle, data: string): error {
    // Pass address of the slice structure, not just the data pointer
    return <error>support::syscall2(support::WRITE_SYSCALL, <byte>handle, <unsafe byte>&data);
  }

  function input(buffer: string): error {
    return read(handle::input, buffer);
  }

  function print(text: string): error {
    return write(handle::output, text);
  }

  function debugger(): void {
    support::debugger();
  }

  function exit(code: byte): void {
    support::syscall1(support::EXIT_SYSCALL, code);
  }

  function create(binary: string): error {
    return <error>support::syscall1(support::CREATE_SYSCALL, <unsafe byte>binary);
  }

  function yield(): void {
    support::syscall(support::YIELD_SYSCALL);
  }
}
