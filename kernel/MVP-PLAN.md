# Plan: Minimal Viable Multi-Process OS

## Goal
Get pre-emptive multi-tasking with memory isolation working, demonstrated by:
- 2+ processes running concurrently
- Each process has isolated virtual memory
- Timer interrupts trigger context switches
- Processes can make syscalls (exit, write)

## Critical Path (Order of Implementation)

### Phase 1: Fix MMU Integration (CRITICAL)

**Problem**: Kernel creates `memory::table` struct but VM expects flat page table format

**Solution**: Write kernel table to memory in VM-expected format

**Changes needed in `kernel/memory.qll`**:

```qll
function _write_table_to_mmu(table: * table): byte {
  // Allocate memory for VM page table format
  // Layout: [size][page0_virt][page0_phys][page0_size][page0_flags]...
  var table_size = len table->pages;
  var table_bytes = 1 + (table_size * 4);  // 1 size + 4 words per page

  var table_addr = allocate_kernel_memory(table_bytes);

  // Write size
  table_addr[unsafe 0] = table_size;

  // Write each page
  for(var i = 0; i < table_size; i = i + 1){
    var page = table->pages[i];
    var offset = 1 + (i * 4);
    table_addr[unsafe offset + 0] = page.virtual_address;
    table_addr[unsafe offset + 1] = page.physical_address;
    table_addr[unsafe offset + 2] = page.size;
    table_addr[unsafe offset + 3] = page.flags;
  }

  return <unsafe byte>table_addr;
}

function use_table(table: * table): void {
  if (!table) {
    mmu->table = null;
    *(<unsafe * byte>peripherals::mmu) = 0;
    return;
  }

  mmu->table = table;
  var table_addr = _write_table_to_mmu(table);
  *(<unsafe * byte>peripherals::mmu) = table_addr;  // Notify MMU
}
```

**Why this works**:
- Converts kernel's struct-based table to VM's flat format
- Allocates table in kernel heap (physical memory)
- Writes address to MMU peripheral memory location
- MMU peripheral's notify() rebuilds internal page cache

**Estimated effort**: 1-2 hours

---

### Phase 2: Fix Task Context Switching

**Problem**: _schedule_task saves/restores registers but MMU table switch happens separately

**Solution**: Ensure MMU table switch is part of task restoration

**Changes needed in `kernel/scheduler.qll`**:

Already correct! `_restore_current_task()` calls `memory::use_table(current_task->table)`.
Just verify it actually works once Phase 1 is fixed.

**Test**: Add logging to verify table switching happens.

**Estimated effort**: 30 minutes (verification)

---

### Phase 3: Create Test Programs

**Create two simple test programs that print repeatedly**:

**tests/programs/hello-a.qll**:
```qll
function main(): byte {
  var i = 0;
  while(i < 10) {
    kernel::syscall::write(1, 'A\n');  // Write to stdout
    i = i + 1;
  }
  kernel::syscall::exit(0);
  return 0;
}
```

**tests/programs/hello-b.qll**:
```qll
function main(): byte {
  var i = 0;
  while(i < 10) {
    kernel::syscall::write(1, 'B\n');
    i = i + 1;
  }
  kernel::syscall::exit(0);
  return 0;
}
```

**Expected output** (interleaved):
```
A
B
A
B
A
...
```

**Changes needed in kernel.qll main()**:
- Load both test programs
- Create process for each
- Enable interrupts
- Wait

**Estimated effort**: 1 hour

---

### Phase 4: Implement User-Space Syscall Wrapper

**Problem**: Test programs need way to make syscalls

**Create lib/syscall.qll** (user-space library):
```qll
namespace syscall {
  function exit(code: byte): void {
    // Trigger interrupt 0x80 with syscall 0x0
    // Set r0 = 0 (EXIT), r1 = code
    // How to trigger interrupt from QLL? Need intrinsic!
  }

  function write(handle: byte, data: byte[]): bool {
    // r0 = 0x2 (WRITE), r1 = handle, r2 = &data
  }
}
```

**Problem**: QLL has no way to trigger interrupt!

**Solution**: Add support function to kernel/support.qll:
```qll
function syscall(num: byte, arg0: byte, arg1: byte, arg2: byte): byte;
```

Implement in assembly:
```asm
constant r0 <arg: num>
constant r1 <arg: arg0>
constant r2 <arg: arg1>
constant r3 <arg: arg2>
int 0x80
; r0 now contains return value
```

**Estimated effort**: 2 hours

---

### Phase 5: Test Memory Isolation

**Create tests/programs/memory-test.qll**:
```qll
function main(): byte {
  var data: byte[10];
  data[0] = 0x42;

  // Try to read from another process's memory (should fail)
  var other_addr = <unsafe * byte>0x2000;  // Another process's heap
  var value = *other_addr;  // Should trigger error interrupt

  return 0;
}
```

**Expected**: Error interrupt triggers, process gets killed

**Estimated effort**: 1 hour

---

## Implementation Order

1. **Phase 1**: Fix MMU integration (CRITICAL - everything else depends on this)
2. **Phase 4**: Add syscall support (needed for test programs)
3. **Phase 3**: Create test programs
4. **Phase 2**: Verify context switching
5. **Phase 5**: Test memory isolation

## Total Estimated Time
- Phase 1: 1-2 hours
- Phase 2: 0.5 hours
- Phase 3: 1 hour
- Phase 4: 2 hours
- Phase 5: 1 hour
- **Total: 5.5-6.5 hours**

## Success Criteria

MVP is achieved when:
1. ✓ Two processes run concurrently
2. ✓ Output is interleaved (proves pre-emption works)
3. ✓ Each process has isolated virtual memory
4. ✓ Invalid memory access kills the process (proves isolation)
5. ✓ Processes can exit cleanly via syscall

## What We're NOT Doing (for now)

- Real filesystem (using debug peripheral proxy)
- Spawn syscall (manually loading binaries)
- Proper memory allocator (bump allocator is fine)
- Shell (not needed for MVP)
- Multiple CPUs/cores
- Advanced scheduling (round-robin is fine)
- IPC/shared memory
- Signal handling
