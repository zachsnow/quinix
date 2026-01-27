# QFS Initialization Issue - RESOLVED

## Original Problem
The kernel was showing "bad magic" when initializing QFS, even though the disk image was valid.

## Root Causes (Multiple)

### 1. Block Device IO Region Mapping
The VM was mapping peripheral IO addresses at `baseAddress`, but BlockDevicePeripheral expected IO to be at `baseAddress + shared` (offset 7). The kernel was writing the command to `base + 7` while the VM was watching `base + 0` for notifications.

**Fix:** Updated BlockDevicePeripheral to place COMMAND at offset 0, matching the existing peripheral convention (IO at the start).

### 2. Console Input Length Not Propagating
The `std::buffered::read()` function tried to set `len data = read_size`, but since slices are passed by value in QLL, this only modified the local copy. The caller's slice length remained at the full capacity (256), causing command parsing to fail.

**Fix:** Changed `std::buffered::read()` to return the byte count instead of bool. Updated all callers (`std::console::input`, kernel syscalls, etc.) to handle the new return type and set the length appropriately.

## Files Modified
- `src/platform/server/peripherals.ts` - Fixed block device memory layout
- `kernel/block.qll` - Updated to match new layout
- `shared/buffered.qll` - Changed read() to return byte count
- `kernel/console.qll` - Updated to return byte count
- `bare/console.qll` - Updated to return byte count
- `kernel/fs.qll` - Updated handle::read to return byte count
- `kernel/syscall.qll` - Updated to use new read API
- `kernel/shell.qll` - Updated to use new input API

## Verification
```
$ ls
hello.txt  16 bytes
$ cat hello.txt
Hello from QFS!
```
