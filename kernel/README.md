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
- `peripherals.qll` - Hardware peripheral discovery (timer, debug I/O, disk, clock, display, keyboard)
- `memory.qll` - Physical memory allocation, page tables (up to 8 pages per process)
- `process.qll` - Process management (with display cleanup on exit)
- `scheduler.qll` - Preemptive process scheduling
- `syscall.qll` - System call handlers (I/O, files, display, keyboard)
- `fs.qll` - Filesystem (QFS)
- `block.qll` - Block device interface
- `console.qll` - Kernel console
- `shell.qll` - Built-in shell
- `support.qasm` - Low-level assembly support

## Allocator

The `alloc.qll` binds `shared/alloc.qll` by setting `std::heap = 0x10000` (the kernel heap region) and exporting `system::alloc`/`system::dealloc` for `new`/`delete` support.
