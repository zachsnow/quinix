# lib/

Support code for usermode programs running under the Quinix kernel.

Usermode programs interact with the kernel via syscalls. This library provides
the syscall interface and standard library functions for user programs.

## Files

- `lib.qll` - OS interface: file handles, syscall wrappers, I/O functions
- `alloc.qll` - Binds the shared allocator with heap at `0x3000` (virtual address)
- `console.qll` - Console I/O via syscalls
- `support.qasm` - Low-level syscall implementation
- `user.qasm` - Usermode program entry point

## Allocator

The `alloc.qll` binds `shared/alloc.qll` by setting `std::heap = 0x3000` (the usermode virtual heap address) and exporting `system::alloc`/`system::dealloc` for `new`/`delete` support.

## Building usermode support libraries

```bash
./build.sh
```

Produces user program binaries in `bin/`.

## Building usermode programs

