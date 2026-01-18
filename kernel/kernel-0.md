# Kernel Implementation Plan - Phase 0

**Goal**: Boot a working pre-emptive multitasking kernel that can run multiple isolated processes.

**Philosophy**: Get to "something resembling a real kernel" ASAP. Use simple implementations (bump allocator, minimal syscalls) that can be enhanced later.

## Current State

### What Works
- VM with MMU, interrupts, timer peripheral
- Basic scheduler structure with round-robin and timer interrupts
- Process/task abstraction with virtual memory
- Syscall framework (interrupt 0x80)
- File I/O via debug peripherals

### Critical Issues
1. Physical memory allocator is stubbed (returns 0x0)
2. Multiple compilation errors preventing build
3. Process initialization not called
4. No parent/child process tracking
5. No PID return from process creation
6. Syscalls incomplete or broken

## Phase 1: Core Fixes & Single Process

**Objective**: Boot kernel, load one process, execute it, exit cleanly.

### 1.1 Physical Memory Management

**File**: `kernel/memory.qll`

**Changes**:

1. Add configurable constants at top of namespace:
```qll
namespace kernel::memory {
  // Configuration
  .constant global TOTAL_PHYSICAL_MEMORY: byte = 0x100000;  // 1MB
  .constant global KERNEL_RESERVED: byte = 0x20000;          // 128KB for kernel
  .constant global CHUNK_SIZE: byte = 0x1000;                // 4KB chunks

  // Kernel heap
  global kernel_heap_base: byte = 0x0;
  global kernel_heap_size: byte = 0x10000;  // 64KB
  global kernel_heap_current: byte = 0x0;

  // User memory pool
  global user_pool_base: byte = 0x0;
  global user_pool_current: byte = 0x0;
  global user_pool_size: byte = 0x0;
```

2. Implement `init()` function:
```qll
function init(): void {
  // Calculate memory layout
  // kernel_heap_base = KERNEL_RESERVED - kernel_heap_size
  // user_pool_base = KERNEL_RESERVED
  // user_pool_size = TOTAL_PHYSICAL_MEMORY - KERNEL_RESERVED

  // Initialize MMU peripheral
  mmu = <unsafe * mmu>kernel::peripherals::mmu;
  if(!mmu){
    panic('memory: mmu not mapped');
  }

  disable();
  use_table(null);

  log('memory: initialized');
}
```

3. Implement bump allocator:
```qll
function allocate_physical_memory(size: byte): byte {
  // Round up to chunk size
  var chunks_needed = (size + CHUNK_SIZE - 1) / CHUNK_SIZE;
  var bytes_needed = chunks_needed * CHUNK_SIZE;

  // Check if we have space
  if(user_pool_current + bytes_needed > user_pool_size){
    return 0;  // Out of memory
  }

  var address = user_pool_base + user_pool_current;
  user_pool_current = user_pool_current + bytes_needed;

  return address;
}

function deallocate_physical_memory(address: byte): void {
  // No-op for bump allocator
  // TODO: implement real allocator later
  return;
}
```

4. Add kernel heap allocator (for kernel data structures):
```qll
function allocate_kernel_memory(size: byte): * byte {
  if(kernel_heap_current + size > kernel_heap_size){
    panic('memory: kernel heap exhausted');
  }

  var address = kernel_heap_base + kernel_heap_current;
  kernel_heap_current = kernel_heap_current + size;
  return <unsafe * byte>address;
}
```

5. Call `memory::init()` from `kernel::init()`

**Test**: Verify memory ranges calculated correctly, allocations succeed.

### 1.2 Fix Compilation Errors

**File**: `kernel/peripherals.qll`

Line 105: Change from `panic` to `return`:
```qll
function init_peripheral(entry: init_table_entry): void {
  for(var i = 0; i < len peripheral_table; i = i + 1){
    var peripheral = peripheral_table[i];
    if(peripheral.identifier == entry.identifier){
      (entry.init)(&peripheral);
      return;  // Fixed: was panic
    }
  }
  kernel::panic('peripherals: peripheral not found.');
}
```

**File**: `kernel/syscall.qll`

Line 34: Fix undefined `call` variable:
```qll
function _exit(sc: syscall): byte {
  var process = process::current_process();
  process::destroy_process(process);
  return 0;
}
```

Line 64: Fix `current_process` reference:
```qll
function _validate_pointer(p: * byte): bool {
  var current = process::current_process();
  return memory::translate(current->table, p) != null;
}
```

Lines 85, 99, 105, 109: Fix type from `string` to `byte[]`:
```qll
function _write(sc: syscall): byte {
  var handle = <unsafe fs::handle>sc.arg0;

  if(!_validate_array<byte[]>(sc.arg1)){
    return 0;
  }
  var data = _translate_array<byte[]>(sc.arg1);

  return fs::write(handle, data);
}
// Similar fixes for _read, _create_process
```

**File**: `kernel/fs.qll`

Line 84: Fix function name:
```qll
function close(handle: handle): void {
  var process = process::current_process();
  var i = std::vector::find_by(process->files, _find_file, handle);
  if(i == -1){
    return;
  }

  _destroy_file(process->files[i]);  // Fixed: was destroy_file

  std::vector::remove(process->files, i);
}
```

**File**: `kernel/kernel.qll`

Add missing `memory::init()` call:
```qll
function init(): void {
  memory::init();      // Add this
  peripherals::init();
  process::init();     // Add this (was missing)
  scheduler::init();
}
```

**Test**: `./build.sh` succeeds with no errors.

### 1.3 Process IDs and Hierarchy

**File**: `kernel/process.qll`

1. Add parent tracking to process struct:
```qll
type process = struct {
  id: byte;
  parent_id: byte;  // 0 means no parent
  task: * scheduler::task;
  table: * memory::table;
  files: fs::files;
};
```

2. Change `create_process` signature to return PID:
```qll
function create_process(binary: byte[], parent_id: byte): byte {
  // ... existing allocation code ...

  var task = scheduler::create_task();
  task->state.ip = executable_base;
  task->state.registers[63] = table->pages[2].physical_address + table->pages[2].size;

  var process = new process = process {
    id = task->id,           // Use task ID as process ID
    parent_id = parent_id,
    task = task,
    table = table,
    files = fs::create_files(),
  };

  std::vector::add(&processes, process);

  // Copy binary...
  std::unsafe_copy(
    <unsafe * byte>(<byte>table->pages[0].physical_address),
    &binary[0],
    len binary,
  );

  scheduler::enqueue_task(process->task);

  return process->id;
}
```

3. Implement recursive kill:
```qll
function _kill_children(parent_id: byte): void {
  // Find all children of this process and kill them
  for(var i = 0; i < len processes; i = i + 1){
    if(processes[i]->parent_id == parent_id){
      destroy_process(processes[i]);
      // Restart loop since we modified the vector
      i = -1;
    }
  }
}

function destroy_process(process: * process): void {
  if(!process){
    panic('process: invalid process');
  }

  // First kill all children recursively
  _kill_children(process->id);

  var i = std::vector::find(processes, process);
  if(i == -1){
    panic('process: unknown process');
  }
  std::vector::remove(processes, i);

  memory::destroy_table(process->table);
  scheduler::destroy_task(process->task);
  fs::destroy_files(process->files);
  delete process;
}
```

**File**: `kernel/kernel.qll`

Update shell creation to use new signature:
```qll
if(!kernel::process::create_process(binary, 0)){  // 0 = no parent
  kernel::panic('unable to create shell task');
}
```

**Test**: Shell process created with PID, can be destroyed.

### 1.4 Configuration Constants

**File**: `kernel/process.qll`

Add configurable limits at top:
```qll
namespace kernel {
  namespace process {
    // Configuration
    .constant global DEFAULT_EXECUTABLE_BASE: byte = 0x1000;
    .constant global DEFAULT_EXECUTABLE_SIZE: byte = 0x1000;  // 4KB
    .constant global DEFAULT_HEAP_SIZE: byte = 0x8000;        // 32KB
    .constant global DEFAULT_STACK_SIZE: byte = 0x1000;       // 4KB
    .constant global MAX_PROCESSES: byte = 32;
```

Update `create_process` to use constants and check limits:
```qll
function create_process(binary: byte[], parent_id: byte): byte {
  // Check process limit
  if(len processes >= MAX_PROCESSES){
    return 0;  // Failed
  }

  // TODO: parse binary header for size hints
  var executable_base = DEFAULT_EXECUTABLE_BASE;
  var executable_size = DEFAULT_EXECUTABLE_SIZE;
  var heap_size = DEFAULT_HEAP_SIZE;
  var stack_size = DEFAULT_STACK_SIZE;

  // ... rest of implementation ...
}
```

### 1.5 Test Program

**File**: `kernel/test-simple.qll`

Create minimal test program:
```qll
function main(): byte {
  // Just exit successfully
  return 0;
}
```

Build and verify:
```bash
./build.sh
bun run bin/qllc.ts kernel/test-simple.qll > kernel/test-simple.qasm
bun run bin/qasm.ts kernel/test-simple.qasm > kernel/test-simple.qbin
# Modify kernel to load test-simple instead of shell
bun run bin/qvm.ts kernel/kernel.qbin
```

**Success Criteria**: Kernel boots, loads process, executes, exits cleanly.

## Phase 2: Multi-Process Support

**Objective**: Run multiple processes concurrently with proper isolation and parent/child relationships.

### 2.1 SPAWN Syscall Implementation

**File**: `kernel/syscall.qll`

Implement `_spawn`:
```qll
function _spawn(sc: syscall): byte {
  // arg0 = path to binary file
  if(!_validate_array<byte[]>(sc.arg0)){
    return 0;
  }
  var path = _translate_array<byte[]>(sc.arg0);

  // Read binary from filesystem
  // For now, use debug file peripheral
  if(!std::buffered::write(&kernel::peripherals::debug_file->control,
                          kernel::peripherals::debug_file->buffer, path)){
    return 0;
  }

  var size = std::buffered::read_size(&kernel::peripherals::debug_file->control,
                                      kernel::peripherals::debug_file->buffer);
  if(size < 1){
    return 0;
  }

  var binary = new byte[size];
  if(!binary){
    return 0;
  }

  if(!std::buffered::read(&kernel::peripherals::debug_file->control,
                          kernel::peripherals::debug_file->buffer, binary)){
    delete binary;
    return 0;
  }

  // Get current process ID as parent
  var parent = process::current_process();
  var child_pid = kernel::process::create_process(binary, parent->id);

  delete binary;
  return child_pid;
}
```

### 2.2 User-Space Library

**File**: `lib/sys.qll`

Create syscall wrappers:
```qll
namespace sys {
  .constant global EXIT: byte = 0x0;
  .constant global READ: byte = 0x1;
  .constant global WRITE: byte = 0x2;
  .constant global OPEN: byte = 0x3;
  .constant global CLOSE: byte = 0x4;
  .constant global CREATE: byte = 0x5;
  .constant global DESTROY: byte = 0x6;
  .constant global SPAWN: byte = 0x7;

  function _syscall(syscall: byte, arg0: byte, arg1: byte, arg2: byte): byte {
    // Put arguments in registers r0-r3
    // Trigger interrupt 0x80
    // Return value from r0
  }

  function exit(code: byte): void {
    _syscall(EXIT, code, 0, 0);
  }

  function write(handle: byte, data: byte[]): byte {
    return _syscall(WRITE, handle, <unsafe byte>&data[0], 0);
  }

  function read(handle: byte, buffer: byte[]): byte {
    return _syscall(READ, handle, <unsafe byte>&buffer[0], 0);
  }

  function spawn(path: byte[]): byte {
    return _syscall(SPAWN, <unsafe byte>&path[0], 0, 0);
  }
}
```

**Note**: The `_syscall` function needs to be implemented in assembly (similar to `support.qasm`).

**File**: `lib/sys.qasm`

```qasm
; Syscall wrapper
; Arguments: r0=syscall#, r1=arg0, r2=arg1, r3=arg2
@global::sys::_syscall:
  ; Arguments are already in the right registers
  ; Syscall number in r0, args in r1-r3
  mov r4 r63          ; Save stack pointer
  load r0 r4          ; Load syscall number
  add r4 r4 r62       ; Move to arg0
  load r1 r4
  add r4 r4 r62       ; Move to arg1
  load r2 r4
  add r4 r4 r62       ; Move to arg2
  load r3 r4

  constant r5 0x80    ; Syscall interrupt number
  int r5

  ; Return value is in r0
  jmp r61             ; Return (assuming r61 is return address register)
```

### 2.3 Multi-Process Test Programs

**File**: `kernel/test-parent.qll`

```qll
using global::sys;

function main(): byte {
  sys::write(1, 'Parent: spawning child...\n');

  var child_pid = sys::spawn('test-child');
  if(child_pid == 0){
    sys::write(1, 'Parent: spawn failed!\n');
    return 1;
  }

  sys::write(1, 'Parent: child spawned with PID ');
  // TODO: write PID
  sys::write(1, '\n');

  // Do some work
  var i = 0;
  while(i < 10){
    sys::write(1, 'Parent working...\n');
    i = i + 1;
  }

  sys::write(1, 'Parent: exiting\n');
  return 0;
}
```

**File**: `kernel/test-child.qll`

```qll
using global::sys;

function main(): byte {
  var i = 0;
  while(i < 10){
    sys::write(1, 'Child working...\n');
    i = i + 1;
  }

  sys::write(1, 'Child: exiting\n');
  return 0;
}
```

### 2.4 Memory Isolation Testing

Create test to verify processes have isolated memory:

**File**: `kernel/test-isolation.qll`

```qll
using global::sys;

global shared_var: byte = 0x42;

function main(): byte {
  sys::write(1, 'Before spawn: ');
  // TODO: write shared_var value

  var child = sys::spawn('test-isolation-child');
  if(!child){
    return 1;
  }

  // Wait a bit (spin)
  var i = 0;
  while(i < 1000000){
    i = i + 1;
  }

  sys::write(1, 'After child: ');
  // TODO: write shared_var value (should still be 0x42)

  return 0;
}
```

**File**: `kernel/test-isolation-child.qll`

```qll
using global::sys;

global shared_var: byte = 0x0;  // Different address space!

function main(): byte {
  shared_var = 0xFF;  // Should not affect parent
  sys::write(1, 'Child modified shared_var\n');
  return 0;
}
```

### 2.5 Scheduler Stress Test

**File**: `kernel/test-scheduler.qll`

Spawn multiple children and verify they all run:

```qll
using global::sys;

function main(): byte {
  sys::write(1, 'Spawning 5 children...\n');

  var i = 0;
  while(i < 5){
    var child = sys::spawn('test-worker');
    if(!child){
      sys::write(1, 'Spawn failed!\n');
      return 1;
    }
    i = i + 1;
  }

  sys::write(1, 'All children spawned\n');

  // Wait for children to finish
  // TODO: implement wait syscall

  return 0;
}
```

**File**: `kernel/test-worker.qll`

```qll
using global::sys;

function main(): byte {
  var i = 0;
  while(i < 100){
    i = i + 1;
  }
  sys::write(1, 'Worker done\n');
  return 0;
}
```

## Phase 2.6: Recursive Kill Test

**File**: `kernel/test-recursive-kill.qll`

```qll
using global::sys;

function main(): byte {
  sys::write(1, 'Parent spawning child chain...\n');

  // Spawn a child that spawns a child
  var child = sys::spawn('test-kill-middle');

  // Wait a bit
  var i = 0;
  while(i < 1000000){
    i = i + 1;
  }

  sys::write(1, 'Parent exiting (should kill descendants)\n');
  return 0;
}
```

**File**: `kernel/test-kill-middle.qll`

```qll
using global::sys;

function main(): byte {
  sys::write(1, 'Middle: spawning grandchild...\n');
  var grandchild = sys::spawn('test-kill-leaf');

  // Infinite loop - should be killed when parent exits
  while(true){
    // spin
  }
}
```

**File**: `kernel/test-kill-leaf.qll`

```qll
using global::sys;

function main(): byte {
  sys::write(1, 'Leaf: running...\n');

  // Infinite loop - should be killed when grandparent exits
  while(true){
    // spin
  }
}
```

## Success Criteria

### Phase 1 Complete When:
- [ ] `./build.sh` succeeds with no errors
- [ ] Kernel boots and initializes all subsystems
- [ ] Physical memory allocator works (bump allocator)
- [ ] Single process loads, runs, and exits cleanly
- [ ] Memory ranges correctly calculated and reserved
- [ ] No panics or faults during single-process execution

### Phase 2 Complete When:
- [ ] SPAWN syscall creates new processes
- [ ] Multiple processes run concurrently
- [ ] Context switching works (processes interleave output)
- [ ] Processes have isolated memory (can't affect each other)
- [ ] Parent death kills all descendants recursively
- [ ] Process limit enforcement works
- [ ] Out-of-memory handled gracefully

## Build & Test Workflow

```bash
# Clean build
./build.sh

# Test single process (Phase 1)
bun run bin/qllc.ts kernel/test-simple.qll > /tmp/test.qasm
bun run bin/qasm.ts /tmp/test.qasm > /tmp/test.qbin
# Modify kernel.qll to load test binary
bun run bin/qvm.ts kernel/kernel.qbin

# Test multi-process (Phase 2)
# Build test programs
for prog in test-parent test-child test-worker; do
  bun run bin/qllc.ts kernel/$prog.qll > /tmp/$prog.qasm
  bun run bin/qasm.ts /tmp/$prog.qasm > /tmp/$prog.qbin
done

# Run kernel with test-parent
bun run bin/qvm.ts kernel/kernel.qbin
```

## Next Steps (Phase 3+)

After Phases 1 & 2 are complete:
- File system operations (OPEN, CLOSE, CREATE, DESTROY)
- Shell completion
- User programs and utilities
- Better memory management (real allocator, heap growth)
- Sleep/wake for processes
- IPC mechanisms

## Notes

- All memory sizes are in bytes (32-bit values)
- Keep error handling simple for now (panic or return 0)
- Focus on correctness over performance
- Log liberally for debugging
- Write tests incrementally as features are completed
