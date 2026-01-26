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

Usermode programs use the `lib::` namespace for OS services. Example (`hello.qll`):

```c
function main(): byte {
  lib::print("Hello, world!");
  return 0;
}
```

To compile and assemble:

```bash
# From project root
bun run bin/qllc.ts --library hello.qll lib/lib.qll lib/system.qll lib/std.qll lib/std.bare.qll
bun run bin/qasm.ts --nosystem -o hello.qbin lib/user.qasm out.qasm lib/support.qasm
```

The `--library` flag compiles without a system preamble, and `--nosystem` assembles without the default system header. The `lib/user.qasm` provides the usermode entry point.

See `kernel/tests/build.sh` for a complete example.
