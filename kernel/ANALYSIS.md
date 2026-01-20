# Kernel Current State Analysis

## What's Implemented

### Core Infrastructure
- **kernel.qll**: Main entry point, initialization sequence
- **peripherals.qll**: Peripheral table access at 0x0200
- **memory.qll**: Memory management with MMU integration
- **scheduler.qll**: Pre-emptive task scheduling with timer interrupt
- **process.qll**: Process creation/destruction with memory tables
- **syscall.qll**: System call interface (interrupt 0x80)
- **fs.qll**: Basic filesystem operations via debug peripherals
- **support.qll**: VM interface stubs (halt, wait, interrupt)

### VM Support
- **ListPageTablePeripheral**: Simple list-based MMU (0x80000002)
  - Layout: [size][page0_virt][page0_phys][page0_size][page0_flags]...
  - Translates virtual → physical addresses
  - Enable/disable support
  - Rebuilds page table on notify

### Memory Management
- Kernel heap: 64KB at top of kernel reserved space
- User memory pool: Bump allocator for process memory
- Page table creation for processes (executable, heap, stack)
- MMU integration (can enable/disable, use_table, translate)

### Scheduling
- Round-robin task scheduling
- Timer interrupt handler (_schedule_task)
- Task state save/restore (all 64 registers + IP)
- Task queue management (intrusive list)

### Process Management
- Create processes from binaries
- Virtual memory tables per process
- Process destruction with child cleanup
- Default memory layout: executable@0x1000, heap, stack

## What's Missing/Broken

### Critical Issues
1. **MMU not connected to kernel memory model**
   - kernel/memory.qll writes `memory::table` struct to memory
   - VM expects different format for page table
   - No code to convert kernel table → VM page table format

2. **Process isolation not working**
   - MMU enable/disable logic exists but table format mismatch
   - No actual memory translation happening

3. **Binary loading incomplete**
   - Copies binary to physical memory directly
   - Doesn't set up page table properly
   - No ELF parsing or relocation

4. **Context switching incomplete**
   - Saves/restores registers and IP
   - But doesn't properly switch MMU table

### Minor Issues
- Syscalls partially implemented (spawn, open, close are TODOs)
- No actual filesystem (just debug peripheral proxies)
- Bump allocator doesn't free (deallocate is no-op)
- Shell not implemented
