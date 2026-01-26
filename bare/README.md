# bare/

Support code for baremetal programs running directly on the VM without an operating system.

Baremetal programs have direct access to hardware peripherals and memory. Use this library when writing standalone programs that don't need OS services.

## Files

- `alloc.qll` - Simple bump allocator using static memory
- `console.qll` - Direct console I/O via peripheral access
