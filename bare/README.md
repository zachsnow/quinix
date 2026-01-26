# bare/

Support code for baremetal programs running directly on the VM without an operating system.

Baremetal programs have direct access to hardware peripherals and memory. Use this library when writing standalone programs that don't need OS services.

## Files

- `alloc.qll` - Binds the shared allocator with heap at `0x8000`
- `console.qll` - Direct console I/O via peripheral access

## Allocator

The `alloc.qll` binds `shared/alloc.qll` by setting `std::heap = 0x8000` and exporting `system::alloc`/`system::dealloc` for `new`/`delete` support.
