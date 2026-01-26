# kernel/

The Quinix operating system kernel.

**Note:** The kernel is under active development and this documentation may be incomplete.

## Building

```bash
./build.sh       # Compile and assemble
./run.sh         # Run in VM
```

## Code Layout

- `kernel.qll` - Entry point, initialization, panic handling
- `alloc.qll` - Binds the shared allocator with heap at `0x10000`
- `peripherals.qll` - Hardware peripheral configuration
- `memory.qll` - Memory management
- `process.qll` - Process management
- `scheduler.qll` - Process scheduling
- `syscall.qll` - System call handlers
- `fs.qll` - Filesystem (QFS)
- `block.qll` - Block device interface
- `console.qll` - Kernel console
- `shell.qll` - Built-in shell
- `support.qasm` - Low-level assembly support

## Allocator

The `alloc.qll` binds `shared/alloc.qll` by setting `std::heap = 0x10000` (the kernel heap region) and exporting `system::alloc`/`system::dealloc` for `new`/`delete` support.
