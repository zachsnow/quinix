# lib/

Support code for usermode programs running under the Quinix kernel.

Usermode programs interact with the kernel via syscalls. This library provides the syscall interface and standard library functions for user programs.

## Files

- `lib.qll` - OS interface: file handles, syscall wrappers, I/O functions
- `alloc.qll` - Memory allocation (heap managed by kernel)
- `console.qll` - Console I/O via syscalls
- `support.qasm` - Low-level syscall implementation
- `user.qasm` - Usermode program entry point

## Building

```bash
./build.sh
```

Produces user program binaries in `bin/`.
