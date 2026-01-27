# Known Issues

## Active Issues

### Userspace Program Execution (syscall handling)

**Status:** In Progress

**Summary:** Userspace programs load correctly and begin executing, but something goes wrong when the program calls the EXIT syscall.

**Symptoms:**
- Process is created successfully (memory allocated, page table created, binary loaded)
- Program starts executing (verified via trace)
- Program calls EXIT syscall (int 0x0)
- After the syscall interrupt, the VM halts unexpectedly

**Observed Behavior:**
When running `run hello` in the shell:
1. Process is created with correct virtual memory layout
2. Timer interrupts work for preemption
3. User program runs and calls EXIT syscall
4. Syscall handler runs (MMU disabled)
5. Process destruction and task switching occurs
6. VM halts with unexpected instruction at address 0x1082

**Investigation Notes:**
- The VM correctly disables MMU on interrupt entry (verified in vm.ts:736-737)
- The VM re-enables MMU on interrupt return (verified in vm.ts:695-696)
- The halt appears to occur after destroy_task switches to a new task
- The instruction at 0x1082 (0x000027e7) looks like data being interpreted as code

**Files Involved:**
- `kernel/syscall.qll` - syscall interrupt handler
- `kernel/process.qll` - process destruction
- `kernel/scheduler.qll` - task switching
- `src/vm/vm.ts` - interrupt handling

**Next Steps:**
1. Add more detailed logging to syscall handler
2. Trace exactly what happens after destroy_process
3. Verify MMU state transitions during syscall
4. Check if interrupt return path is correct after task switch

---

## Resolved Issues

### QFS Initialization Issue

**Status:** Resolved

**Summary:** The kernel showed "bad magic" when initializing QFS, even though the disk image was valid.

**Root Causes:**

1. **Block Device IO Region Mapping:** The VM was mapping peripheral IO addresses at `baseAddress`, but BlockDevicePeripheral expected IO to be at `baseAddress + shared` (offset 7). The kernel was writing the command to `base + 7` while the VM was watching `base + 0` for notifications.

2. **Console Input Length Not Propagating:** The `std::buffered::read()` function tried to set `len data = read_size`, but since slices are passed by value in QLL, this only modified the local copy. The caller's slice length remained at the full capacity, causing command parsing to fail.

**Fixes:**
- Updated BlockDevicePeripheral to place COMMAND at offset 0
- Changed `std::buffered::read()` to return the byte count instead of bool
- Updated all callers to handle the new return type

**Files Modified:**
- `src/platform/server/peripherals.ts`
- `kernel/block.qll`
- `shared/buffered.qll`
- `kernel/console.qll`
- `bare/console.qll`
- `kernel/fs.qll`
- `kernel/syscall.qll`
- `kernel/shell.qll`

**Verification:**
```
$ ls
hello.txt  16 bytes
$ cat hello.txt
Hello from QFS!
```
