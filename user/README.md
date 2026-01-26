# user/

Support code for usermode programs running under the Quinix kernel.

Usermode programs interact with the kernel via syscalls. This directory provides the syscall interface, allocator binding, and entrypoint for user programs.

## Files

- `lib.qll` - OS interface: file handles, syscall wrappers, I/O functions
- `alloc.qll` - Binds the shared allocator with heap at `0x3000` (virtual address)
- `console.qll` - Console I/O via syscalls
- `support.qasm` - Low-level syscall implementation (int 0x80)
- `entrypoint.qasm` - Usermode program entry point

## Allocator

The `alloc.qll` binds `shared/alloc.qll` by setting `std::heap = 0x3000` (the usermode virtual heap address) and exporting `system::alloc`/`system::dealloc` for `new`/`delete` support.

## Building usermode programs

Usermode programs use the `lib::` namespace for OS services. Example (`hello.qll`):

```c
function main(): byte {
  lib::print("Hello, world!");
  return 0;
}
```

To compile and assemble with `--target=user`:

```bash
qllc --target=user hello.qll -o hello.qasm
qasm --target=user hello.qasm -o hello.qbin
```

The `--target=user` flag automatically includes:
- `shared/*.qll` (standard library, allocator)
- `user/*.qll` (syscall wrappers, allocator binding)
- `user/entrypoint.qasm` and `user/support.qasm` at assembly time

See `kernel/tests/build.sh` for a complete example.
