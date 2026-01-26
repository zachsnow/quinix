# shared/

Common code shared across all execution contexts: kernel, usermode programs, and baremetal programs.

This code must not depend on any specific runtime environment.

## Files

- `std.qll` - Standard library: string operations, memory utilities, data structures
- `alloc.qll` - Generic allocator implementation
- `buffered.qll` - Buffered I/O helpers for peripheral access
