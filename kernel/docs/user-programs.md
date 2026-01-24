# User Program Loading

This document describes how the kernel loads and starts user programs.

## Overview

User programs are compiled QLL binaries that run in isolated virtual address spaces. The kernel handles memory setup, and a minimal user-mode runtime (`lib/user.qasm`) handles program startup.

## Compilation

User programs are compiled with special flags:

```bash
# Compile without entrypoint (kernel provides memory layout)
qllc --library program.qll lib/lib.qll ...

# Assemble with user runtime at start
qasm --nosystem -o program.qbin lib/user.qasm out.qasm lib/support.qasm
```

Key points:
- `--library` omits the standard entrypoint that sets SP to a hardcoded value
- `lib/user.qasm` is linked first, providing the entry point at 0x1000
- `--nosystem` omits the system runtime (heap initialization) since the kernel manages memory

## Memory Layout

The kernel creates a virtual address space for each process:

```
0x0000 - 0x0FFF  Unmapped (guard page, catches null pointers)
0x1000 - 0x1FFF  Executable (4KB) - code and read-only data
0x2000 - 0x2FFF  Unmapped (guard page)
0x3000 - 0xAFFF  Heap (32KB) - dynamic allocations
0xB000 - 0xBFFF  Unmapped (guard page)
0xC000 - 0xCFFF  Stack (4KB) - grows downward
```

## Process Startup

When the kernel switches to a new process:

1. **Kernel sets up registers:**
   - `r63` (SP) = top of stack (0xD000)
   - `IP` = 0x1000 (start of executable)
   - All other registers = 0

2. **User runtime executes** (`lib/user.qasm`):
   - Initializes `r62` (ONE) = 1 (required for QLL calling convention)
   - Calls `@global::main`
   - When main returns, calls `lib::exit` with return value

3. **Program runs** until it calls `exit` or faults

## Syscall Interface

User programs communicate with the kernel via interrupt 0x80:

- `r0` = syscall number
- `r1`, `r2`, `r3` = arguments
- Return value placed in `r0`

Syscalls defined in `lib/lib.qll`:
- `EXIT (0)` - terminate process
- `READ (1)` - read from handle
- `WRITE (2)` - write to handle
- `OPEN (3)` - open file (not implemented)
- `CLOSE (4)` - close handle (not implemented)

## Future: Process Info Block

A future enhancement could have the kernel provide layout information at a known virtual address, allowing user programs to dynamically configure their allocator:

```
0x0F00 - 0x0FFF  Process Info Block
  +0x00: stack_base
  +0x01: stack_size
  +0x02: heap_base
  +0x03: heap_size
```

The user runtime would read these values to initialize SP and configure the heap allocator, rather than relying on hardcoded addresses.
