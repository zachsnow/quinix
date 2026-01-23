# Quinix Kernel

A pre-emptive multitasking kernel with memory isolation for the Quinix VM.

## Architecture Overview

```
Kernel Boot (kernel.qll:main)
  → peripherals::init()  - find hardware in VM peripheral table
  → memory::init()       - set up bump allocator, MMU pointer
  → process::init()      - create process vector, register error handler
  → syscall::init()      - register interrupt 0x80 handler
  → scheduler::init()    - create task 0, register timer handler
  → load test programs   - read binaries, create processes
  → enable interrupts    - start scheduling
  → idle loop            - wait for interrupts
```

## Current State

### What Works

**Peripherals** (`peripherals.qll`)
- Reads VM peripheral table at 0x200
- Initializes: timer, debug_output, debug_input, debug_file, mmu
- Buffered peripheral abstraction for I/O

**Memory** (`memory.qll`)
- Bump allocator for user memory pool (0x20000 - 0xFFFFF)
- Kernel heap allocator (0x10000 - 0x1FFFF)
- Page table creation with 3 pages: executable (0x1000), heap (0x3000), stack (0xC000)
- Virtual-to-physical translation via linear scan
- MMU table switching via `use_table()`

**Process** (`process.qll`)
- Process struct with id, parent_id, task, table, files
- `create_process()` allocates memory, creates task, copies binary, enqueues
- `destroy_process()` recursively kills children, cleans up resources
- Error interrupt handler kills faulting process

**Scheduler** (`scheduler.qll`)
- Linked list of tasks, round-robin scheduling
- Timer interrupt every 100 cycles triggers context switch
- `_schedule_task()` saves state, advances to next task, restores state + MMU table
- `destroy_task()` safely handles destroying current task

**Syscalls** (`syscall.qll`)
- Interrupt 0x80 handler extracts args from r0-r3
- Dispatch table maps syscall number to handler
- Pointer validation via `_translate()` against current process's page table
- Slice access via `_get_slice_data()` / `_get_slice_len()`

**Filesystem** (`fs.qll`)
- Handle abstraction: OUTPUT=0x1, INPUT=0x2
- `write_byte()` writes single byte to debug_output peripheral
- Per-process file table for open files

**User Library** (`lib/lib.qll` + `lib/support.qasm`)
- `lib::print(text)` → `lib::write(output, text)` → `syscall2(WRITE, handle, text)`
- `lib::exit(code)` → `syscall1(EXIT, code)`
- Assembly stubs trigger `int 0x80` with args in registers

### What's Broken

**Handle Value Mismatch**
- `lib/lib.qll:33-34`: `input = 0x1`, `output = 0x2`
- `kernel/fs.qll:5-6`: `OUTPUT = 0x1`, `INPUT = 0x2`
- When user calls `lib::print()`, it passes handle 0x2, but kernel expects 0x1 for output
- **Fix**: Change one to match the other

**Assembly Calling Convention** (`lib/support.qasm:48-72`)
- `syscall2` reads arguments from stack at hardcoded offsets (+4, +3, +2)
- These offsets may not match how qllc passes function arguments
- Needs verification against actual qllc output

**Task 0 Has No Page Table**
- `scheduler::init()` creates task 0 as idle task
- Task 0's `table` field is never set (null)
- If scheduler switches back to task 0, MMU gets null table
- May cause issues when all user tasks exit

**Binary Size Not Validated** (`process.qll:73-77`)
- Binary copied to executable region without size check
- Executable region is 0x1000 (4KB)
- If binary > 4KB, overwrites heap region
- Test binaries are ~5KB (`hello-a` is 5080 bytes)

**Unused Memory Constants** (`memory.qll:43-44`)
- `chunk_size = 0x4000` and `max_chunks = 0x400` are defined but never used
- Actual chunk size is `CHUNK_SIZE = 0x1000`
- Dead code that may cause confusion

### What's Stubbed

| Syscall | Number | Status |
|---------|--------|--------|
| EXIT | 0x0 | Working |
| READ | 0x1 | Stub (returns 0) |
| WRITE | 0x2 | Working |
| OPEN | 0x3 | Stub |
| CLOSE | 0x4 | Stub |
| CREATE | 0x5 | Stub |
| DESTROY | 0x6 | Stub |
| SPAWN | 0x7 | Stub |

**Shell** (`shell.qll`)
- References undefined: `lib::spawn`, `print`, `read_command`, `parse_command`, `find_command`
- Non-functional placeholder

## Phase 1: Single Process Prints Output

**Goal**: Kernel loads one process, process prints text, process exits.

### 1.1 Fix Handle Mismatch

In `lib/lib.qll`, swap handle values to match kernel:
```qll
namespace handle {
  .constant global input: handle = 0x2;   // was 0x1
  .constant global output: handle = 0x1;  // was 0x2
}
```

### 1.2 Verify Assembly Calling Convention

Examine qllc output for a simple syscall call. Check if `lib/support.qasm` stack offsets match.

If broken, rewrite assembly to use correct offsets or switch to register-based argument passing.

### 1.3 Fix Binary Size

Either:
- Increase DEFAULT_EXECUTABLE_SIZE in `process.qll` to 0x2000 (8KB)
- Or add binary size validation and reject oversized binaries

### 1.4 Test

```bash
cd kernel/tests && ./build.sh hello-a.qll
cd ../..
./build.sh
bun run bin/qvm.ts kernel/kernel.qbin
```

Expected: See "A" printed repeatedly, then clean exit.

## Phase 2: Multiple Processes with Context Switching

**Goal**: Two processes run concurrently with interleaved output.

### 2.1 Fix Task 0 Page Table

Option A: Give task 0 a valid kernel page table
Option B: Never schedule task 0 (skip it in round-robin)

### 2.2 Verify Context Switching

With handle mismatch fixed, both hello-a and hello-b should print. Output should interleave:
```
A
B
A
B
...
```

### 2.3 Verify Process Exit

When a process calls `lib::exit()`:
1. Syscall handler calls `process::destroy_process()`
2. Process removed from list, task destroyed
3. Scheduler picks next task
4. No crash or hang

## Phase 3: SPAWN Syscall

**Goal**: Process can spawn child processes.

### 3.1 Implement _spawn

```qll
function _spawn(sc: syscall): byte {
  // Validate and translate path from user space
  var path_addr = <unsafe * byte>sc.arg0;
  if (!_validate_slice(path_addr)) {
    return 0;
  }
  var path_data = _get_slice_data(path_addr);
  var path_len = _get_slice_len(path_addr);

  // Copy to kernel buffer
  var path = new byte[path_len + 1];
  for (var i = 0; i < path_len; i = i + 1) {
    path[i] = path_data[unsafe i];
  }
  path[path_len] = 0;

  // Load binary via debug_file peripheral
  if (!std::buffered::write(&peripherals::debug_file->control,
      &peripherals::debug_file->size, &peripherals::debug_file->buffer[0], path)) {
    delete path;
    return 0;
  }

  var binary = new byte[0x2000];
  if (!std::buffered::read(&peripherals::debug_file->control,
      &peripherals::debug_file->size, &peripherals::debug_file->buffer[0], binary)) {
    delete path;
    delete binary;
    return 0;
  }

  // Create child process with current as parent
  var parent = process::current_process();
  var child_pid = process::create_process(binary, parent->id);

  delete path;
  delete binary;
  return child_pid;
}
```

### 3.2 Add lib::spawn

In `lib/lib.qll`:
```qll
function spawn(path: string): byte {
  return <byte>support::syscall1(support::SPAWN_SYSCALL, <unsafe byte>path);
}
```

### 3.3 Test Parent/Child

Create test programs that spawn children and verify:
- Child runs concurrently with parent
- Parent exit kills children (recursive kill)

## File Reference

| File | Description |
|------|-------------|
| `kernel.qll` | Boot sequence, main loop, log/panic |
| `memory.qll` | Bump allocator, page tables, MMU |
| `process.qll` | Process lifecycle, parent/child tracking |
| `scheduler.qll` | Round-robin scheduler, context switch |
| `syscall.qll` | Syscall dispatch and handlers |
| `fs.qll` | File handles, debug peripheral I/O |
| `peripherals.qll` | Hardware initialization |
| `support.qll` | Assembly function declarations |
| `support.qasm` | Assembly: halt, wait, interrupt setup |
| `lib/lib.qll` | User-space syscall wrappers |
| `lib/support.qasm` | User-space syscall assembly |

## Memory Layout

**Physical Memory**
```
0x00000 - 0x001FF   Interrupt vectors, VM state
0x00200 - 0x0FFFF   Kernel code/data, peripheral table
0x10000 - 0x1FFFF   Kernel heap (64KB)
0x20000 - 0xFFFFF   User pool (896KB, bump allocated)
```

**Per-Process Virtual Memory**
```
0x00000 - 0x00FFF   Unmapped (null pointer protection)
0x01000 - 0x01FFF   Executable (4KB, RX)
0x02000 - 0x02FFF   Unmapped (underrun protection)
0x03000 - 0x0AFFF   Heap (32KB, RW)
0x0B000 - 0x0BFFF   Unmapped (overflow protection)
0x0C000 - 0x0CFFF   Stack (4KB, RW)
```

## Deferred

- READ syscall implementation
- OPEN/CLOSE/CREATE/DESTROY syscalls
- Real memory allocator (free list)
- Binary format with size/entry headers
- WAIT syscall
- Shell implementation
- IPC
