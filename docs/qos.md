# Quinix Operating System

So far, we has... very little.

## User Programs

This document describes how the kernel loads and starts user programs.

### Overview

User programs are compiled QLL binaries that run in isolated virtual address spaces. The kernel handles memory setup, and the user-mode runtime (`user/entrypoint.qasm`) handles program startup.

### Compilation

User programs are compiled with `--target=user`:

```bash
# Compile (auto-includes shared/*.qll and user/*.qll)
qllc --target=user program.qll -o program.qasm

# Assemble (auto-includes user/entrypoint.qasm and user/support.qasm)
qasm --target=user program.qasm -o program.qbin
```

The `--target=user` flag:
- Auto-includes the standard library (`shared/*.qll`) and usermode support (`user/*.qll`)
- Generates a usermode entrypoint that initializes ONE, runs global init, calls main, and exits via syscall
- Auto-includes `user/entrypoint.qasm` and `user/support.qasm` at assembly time

### Memory Layout

The kernel creates a virtual address space for each process:

```
0x0000 - 0x0FFF  Unmapped (guard page, catches null pointers)
0x1000 - 0x1FFF  Executable (4KB) - code and read-only data
0x2000 - 0x2FFF  Unmapped (guard page)
0x3000 - 0xAFFF  Heap (32KB) - dynamic allocations
0xB000 - 0xBFFF  Unmapped (guard page)
0xC000 - 0xCFFF  Stack (4KB) - grows downward
```

### Process Startup

When the kernel switches to a new process:

1. **Kernel sets up registers:**
   - `r63` (SP) = top of stack (0xD000)
   - `IP` = 0x1000 (start of executable)
   - All other registers = 0

2. **User runtime executes** (`user/entrypoint.qasm`):
   - Initializes `r62` (ONE) = 1 (required for QLL calling convention)
   - Calls `@global::_init` to initialize globals
   - Calls `@global::main`
   - When main returns, exits via EXIT syscall with return value

3. **Program runs** until it calls `exit` or faults

### Syscall Interface

User programs communicate with the kernel via interrupt 0x80:

- `r0` = syscall number
- `r1`, `r2`, `r3` = arguments
- Return value placed in `r0`

Syscalls defined in `user/lib.qll`:
- `EXIT (0)` - terminate process
- `READ (1)` - read from handle
- `WRITE (2)` - write to handle
- `OPEN (3)` - open file by path
- `CLOSE (4)` - close handle
- `CREATE (5)` - create empty file
- `DESTROY (6)` - delete file
- `SPAWN (7)` - spawn process (not implemented)
- `YIELD (8)` - yield to scheduler
- `DISPLAY_OPEN (9)` - open display at requested resolution
- `DISPLAY_FLIP (10)` - present framebuffer to screen
- `DISPLAY_CLOSE (11)` - release display ownership
- `KEY_STATE (12)` - read keyboard state bitmask

### Future: Process Info Block

A future enhancement could have the kernel provide layout information at a known virtual address, allowing user programs to dynamically configure their allocator:

```
0x0F00 - 0x0FFF  Process Info Block
  +0x00: stack_base
  +0x01: stack_size
  +0x02: heap_base
  +0x03: heap_size
```

The user runtime would read these values to initialize SP and configure the heap allocator, rather than relying on hardcoded addresses.
