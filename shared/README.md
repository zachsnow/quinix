# shared/

Common code shared across all execution contexts: kernel, usermode programs, and baremetal programs.

This code must not depend on any specific runtime environment.

## Files

- `std.qll` - Standard library: string operations, memory utilities, data structures
- `alloc.qll` - Generic allocator implementation
- `buffered.qll` - Buffered I/O helpers for peripheral access

## Allocator Binding

The allocator in `alloc.qll` provides `std::alloc()` and `std::dealloc()` but requires the global `std::heap` pointer to be set before first use. Each execution context (kernel, lib, bare) provides its own `alloc.qll` that:

1. Sets `std::heap` to the appropriate memory address for that context
2. Exports `system::alloc()` and `system::dealloc()` which the compiler uses to implement `new` and `delete`

This allows the same allocator logic to work across different memory layouts.
