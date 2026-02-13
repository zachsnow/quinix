# Usermode Binary Execution Bug

## Status: RESOLVED

## Root Cause

The binary load buffer in `kernel/kernel.qll:load_executable` was only `0x1000`
words (4096). User binaries that include the standard library (with font data,
allocator, etc.) are ~5968 words. The read loop also capped total reads at
`0x1000 - total`, so only the first 4096 words were loaded. The remaining words
were left as zero (HALT instructions), causing the user code to hit a HALT when
execution reached the unloaded portion.

## Fix

Changed the buffer from `0x1000` to `0x8000` (matching `DEFAULT_EXECUTABLE_SIZE`)
in `kernel/kernel.qll:load_executable`, and updated the read loop cap accordingly.

## Investigation Notes

### What worked correctly
- Kernel boot, shell, filesystem, process creation
- Timer interrupt handling and scheduler task switching
- INT 0x0 (interrupt return) correctly restored user task state (IP=0x1000,
  SP=0x2b000, interrupts enabled, MMU enabled)
- MMU correctly mapped virtual 0x1000 to physical 0x20000

### The misleading symptom
The VM appeared to "hang" after the scheduler switched to the user task. In
reality, user code WAS executing — but it ran through the `_init` function
(initializing font data, ~87K cycles), then hit a HALT instruction in the
unloaded portion of the binary.

### How it was found
1. Added instruction tracing after INT 0x0 — confirmed user code was executing.
2. The HALT fired at virtual 0x208b (the `main` function's entry point in the
   rearranged binary).
3. The binary file at that offset contained valid code (`0x073f3f3e` = `sub r63
   r63 r62`), but physical memory had 0x0 (HALT).
4. A memory check right after INT 0x0 confirmed the address was already zero
   BEFORE user code ran — the binary was never loaded there.
5. `load_executable` allocates `new byte[0x1000]` and reads at most `0x1000`
   words. The binary is 5968 words, so words 4096-5967 were never loaded.

### Why the binary is so large
A simple `lib::print("Hello from Quinix!")` program compiles to ~5968 words
because the standard library includes:
- Graphics font data (760 words, initialized in `_init`)
- Memory allocator (`alloc`, `dealloc`, `_merge_blocks`)
- String formatting (`std::fmt::fs`)
- System allocator wrappers
- Syscall support routines
