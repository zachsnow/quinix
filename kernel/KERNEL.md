# Quinix Kernel

A pre-emptive multitasking kernel with memory isolation for the Quinix VM.

## Current State

### Working

- **Memory Management** (`memory.qll`)
  - Bump allocator for physical memory (user pool)
  - Separate kernel heap allocation
  - Page table creation with 3-page layout (executable, heap, stack)
  - MMU integration: writes table address to MMU peripheral
  - Virtual-to-physical address translation

- **Process Management** (`process.qll`)
  - Process creation with PID assignment
  - Parent/child tracking via `parent_id`
  - Recursive child killing on parent death
  - Process limit enforcement (MAX_PROCESSES = 32)
  - Error interrupt handler kills faulting process

- **Scheduler** (`scheduler.qll`)
  - Round-robin scheduling via linked list
  - Timer interrupt-driven preemption (100 cycle interval)
  - Context switching: saves/restores registers, switches MMU tables
  - Task 0 created at init as idle/kernel task

- **Syscall Framework** (`syscall.qll`)
  - Interrupt 0x80 handler
  - Dispatch table for syscall numbers
  - User pointer validation and translation
  - EXIT: destroys current process
  - WRITE: writes bytes to handle (OUTPUT handle works)

- **Filesystem** (`fs.qll`)
  - Handle abstraction (OUTPUT=1, INPUT=2)
  - Per-process file tracking
  - Debug peripheral proxy for actual I/O

- **Peripherals** (`peripherals.qll`)
  - Timer, debug I/O, debug file, MMU all initialized from VM peripheral table

- **Kernel Boot** (`kernel.qll`)
  - Loads two test programs via debug file peripheral
  - Initializes all subsystems
  - Enters idle loop with interrupts enabled

### Not Working / Incomplete

- **User-space syscall library** - Test programs reference `lib::print` and `lib::exit` which don't exist
- **SPAWN syscall** - Stubbed, returns 0
- **READ syscall** - Stubbed, returns 0
- **OPEN/CLOSE/CREATE/DESTROY syscalls** - Stubbed
- **Shell** (`shell.qll`) - Incomplete, references undefined functions

## Phase 1: Single Process Execution

**Goal**: One process loads, runs, prints output, exits cleanly.

### 1.1 Create User-Space Library

Create `kernel/lib.qll` with syscall wrappers:

```qll
namespace lib {
  function _syscall(num: byte, arg0: byte, arg1: byte, arg2: byte): byte;

  function exit(code: byte): void {
    _syscall(0, code, 0, 0);  // EXIT = 0
  }

  function print(message: byte[]): void {
    _syscall(2, 1, <unsafe byte>&message, 0);  // WRITE = 2, OUTPUT = 1
  }
}
```

### 1.2 Implement Syscall Assembly Support

Create `kernel/lib.qasm` with the `_syscall` function that:
1. Loads arguments into r0-r3
2. Triggers `int 0x80`
3. Returns result from r0

### 1.3 Fix Test Programs

Update `kernel/tests/hello-a.qll` and `hello-b.qll` to use correct paths:
- Change `lib::print` to use proper syscall
- Change `lib::exit` to use proper syscall

### 1.4 Verification

```bash
./build.sh
bun run bin/qvm.ts kernel/kernel.qbin
```

Expected: Both test programs print their letters interleaved, then exit.

## Phase 2: Multi-Process with SPAWN

**Goal**: Process can spawn child processes; parent death kills children.

### 2.1 Implement SPAWN Syscall

In `syscall.qll`, implement `_spawn`:
1. Validate path pointer from user space
2. Read binary from debug file peripheral
3. Call `process::create_process` with current process as parent
4. Return child PID (or 0 on failure)

```qll
function _spawn(sc: syscall): byte {
  var path_addr = <unsafe * byte>sc.arg0;
  if (!_validate_slice(path_addr)) {
    return 0;
  }

  var path_data = _get_slice_data(path_addr);
  var path_len = _get_slice_len(path_addr);

  // Copy path to kernel buffer (null-terminated)
  var path = new byte[path_len + 1];
  for (var i = 0; i < path_len; i = i + 1) {
    path[i] = path_data[unsafe i];
  }
  path[path_len] = 0;

  // Load binary via debug file peripheral
  if (!std::buffered::write(
    &peripherals::debug_file->control,
    &peripherals::debug_file->size,
    &peripherals::debug_file->buffer[0],
    path
  )) {
    delete path;
    return 0;
  }

  var binary = new byte[0x1000];
  if (!std::buffered::read(
    &peripherals::debug_file->control,
    &peripherals::debug_file->size,
    &peripherals::debug_file->buffer[0],
    binary
  )) {
    delete path;
    delete binary;
    return 0;
  }

  var parent = process::current_process();
  var child_pid = process::create_process(binary, parent->id);

  delete path;
  delete binary;
  return child_pid;
}
```

### 2.2 Add spawn() to User Library

```qll
function spawn(path: byte[]): byte {
  return _syscall(7, <unsafe byte>&path, 0, 0);  // SPAWN = 7
}
```

### 2.3 Create Spawn Test Programs

**kernel/tests/spawn-parent.qll**:
```qll
function main(): byte {
  lib::print('Parent: spawning child...\n');
  var pid = lib::spawn('tests/spawn-child');
  if (!pid) {
    lib::print('Parent: spawn failed\n');
    lib::exit(1);
  }
  lib::print('Parent: child spawned\n');

  var i = 0;
  while (i < 5) {
    lib::print('Parent working\n');
    i = i + 1;
  }

  lib::print('Parent: exiting\n');
  lib::exit(0);
  return 0;
}
```

**kernel/tests/spawn-child.qll**:
```qll
function main(): byte {
  var i = 0;
  while (i < 5) {
    lib::print('Child working\n');
    i = i + 1;
  }
  lib::print('Child: exiting\n');
  lib::exit(0);
  return 0;
}
```

### 2.4 Test Recursive Kill

**kernel/tests/kill-parent.qll** - spawns child, then exits (child should be killed)
**kernel/tests/kill-child.qll** - infinite loop (should be killed when parent exits)

### 2.5 Verification

1. Run spawn-parent: should see interleaved Parent/Child output
2. Run kill-parent: child should be terminated when parent exits
3. Spawn 5+ processes: verify they all run concurrently

## Success Criteria

### Phase 1 Complete
- [ ] `./build.sh` succeeds
- [ ] Kernel boots and initializes all subsystems
- [ ] Test program loads and runs
- [ ] Output appears via WRITE syscall
- [ ] Process exits cleanly via EXIT syscall
- [ ] No panics during execution

### Phase 2 Complete
- [ ] SPAWN syscall creates child processes
- [ ] Multiple processes run concurrently (interleaved output)
- [ ] Memory isolation works (processes can't access each other)
- [ ] Parent death kills all descendants
- [ ] Process limit enforcement works

## File Summary

| File | Purpose |
|------|---------|
| `kernel.qll` | Boot, init, main loop |
| `memory.qll` | Physical memory allocator, page tables, MMU |
| `process.qll` | Process creation/destruction, PID management |
| `scheduler.qll` | Round-robin scheduler, context switching |
| `syscall.qll` | System call dispatch and handlers |
| `fs.qll` | File handle abstraction |
| `peripherals.qll` | Hardware peripheral initialization |
| `support.qll` | Assembly function declarations |
| `lib.qll` | User-space syscall wrappers (TODO) |
| `tests/*.qll` | Test programs |

## Memory Layout

```
0x00000 - 0x001FF   Reserved (null protection, interrupt vectors)
0x00200 - 0x0FFFF   Kernel code and data
0x10000 - 0x1FFFF   Kernel heap (64KB)
0x20000 - 0xFFFFF   User memory pool (896KB)
```

Each process gets:
- Executable: 4KB at virtual 0x1000
- Heap: 32KB at virtual 0x3000
- Stack: 4KB at virtual 0xC000

## Deferred Work

- Real memory allocator (free list instead of bump)
- Binary format with size headers
- WAIT syscall for parent to wait on child
- IPC mechanisms
- Proper shell implementation
- Additional syscalls (OPEN, CLOSE, CREATE, DESTROY)
