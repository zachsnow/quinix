# Spawn Args Investigation Report

## Summary

Investigation into why usermode programs aren't running correctly in the Quinix kernel. The original goal was to make `run prog.qbin args...` work in the kernel shell.

## Fixed Issues

### FAT Indexing Bug (FIXED)

In `kernel/fs.qll`, the `fat_read` and `fat_write` functions had a mismatch with the QFS tool (`src/platform/server/qfs.ts`):

**Original (buggy):**
```qll
var fat_index = data_sector - sb.data_start;
```

**Fixed:**
```qll
var fat_index = data_sector;
```

The QFS tool uses sector number directly as FAT index, but the kernel was subtracting `data_start`. This caused the kernel to read from wrong sectors in the FAT chain, resulting in corrupted binary loading.

**Result:** After this fix, `minimal.qbin` (a program that just returns 42) works correctly.

## Remaining Issues

### hello.qbin Fails with Invalid Slice

When running `hello.qbin` (which calls `lib::print("Hello from userspace!\n")`), the WRITE syscall fails with "invalid slice".

**Symptoms:**
- The slice address is correctly identified as being in the stack range (0x1B000-0x2B000)
- The slice length field reads correctly as 22 (length of "Hello from userspace!\n")
- BUT the data pointer field (first word of slice) contains an invalid address (> 0x2B000)

**Investigation findings:**

1. The string literal is stored ON THE STACK, not in the executable section. The compiler generates code to copy each character to the stack, then creates a slice pointing to it.

2. The slice structure layout is: `[pointer, length, capacity]` (3 words)

3. When the kernel reads the slice from physical memory after translation:
   - `physical_slice[1]` (length) = 22 (correct)
   - `physical_slice[0]` (pointer) = some value > 0x2B000 (WRONG)

4. The expected pointer should be a stack address in range 0x1B000-0x2AFFF

**Possible causes:**
- Memory translation returning wrong physical address
- Binary not being loaded correctly to the right physical location
- Offset issue when reading from translated physical memory

### Binary Format Observations

Looking at the assembled binary vs the assembly source:

- Assembly shows `constant r1 @global::std::fmt::fs` at address 0x1002
- But the binary at that offset shows `constant r0 0x1007`

This suggests either:
1. The entrypoint code is prepended (which it is - `user/entrypoint.qasm`)
2. Or there's an assembly/linking issue

The binary actually starts with the entrypoint:
```asm
@_entrypoint:
  constant r62 0x1          ; ONE = 1
  constant r0 @_after_init
  constant r1 @global::_init
  jmp r1
```

## Memory Layout

User process virtual memory:
- Executable: 0x1000 - 0x8FFF (32KB)
- Guard page: 0x9000 - 0x9FFF
- Heap: 0xA000 - 0x19FFF (64KB)
- Guard page: 0x1A000 - 0x1AFFF
- Stack: 0x1B000 - 0x2AFFF (64KB)
- Initial SP: 0x2B000 (just past end, first push goes to 0x2AFFF)

## Files Modified

- `kernel/fs.qll` - Fixed FAT indexing
- `kernel/process.qll` - Added/removed debug logging
- `kernel/syscall.qll` - Added/removed debug logging
- `kernel/memory.qll` - Added/removed debug logging

## Next Steps

1. Use the MCP interactive REPL with the QVM debugger to step through execution
2. Verify the binary is being loaded to the correct physical address
3. Check if the stack pointer initialization is correct
4. Trace through the actual memory reads to see where the bad pointer value comes from
5. Consider checking the main quinix repo (not worktree) for reference implementations

## Test Commands

```bash
# Rebuild kernel
cd kernel && bun run ../bin/qllc.ts --target=none kernel.qll alloc.qll support.qll scheduler.qll peripherals.qll process.qll memory.qll fs.qll syscall.qll console.qll shell.qll block.qll ../shared/std.qll ../shared/alloc.qll ../shared/buffered.qll && bun run ../bin/qasm.ts --target=none -o kernel.qbin support.qasm out.qasm

# Rebuild test binary
bun run ../bin/qllc.ts --target=user tests/hello.qll -o tests/hello.qasm && bun run ../bin/qasm.ts --target=user tests/hello.qasm -o tests/hello.qbin

# Update disk
bun run ../bin/qfs.ts create disk.img && bun run ../bin/qfs.ts add disk.img tests/hello.qbin --exec

# Run kernel
echo "run hello.qbin" | bun run ../bin/qvm.ts kernel.qbin --disk=disk.img
```
