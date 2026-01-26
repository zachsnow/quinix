# Kernel Development Plan

## Current State

The kernel has:
- Working shell with `ls`, `cat`, `pwd`, `echo`, `help`, `exit`
- QFS v2 filesystem (flat root, 4 entry limit, FAT allocation)
- Syscalls: EXIT, READ, WRITE, OPEN, CLOSE (CREATE, DESTROY, SPAWN are stubs)
- Process/scheduler with preemptive multitasking
- Virtual memory with MMU
- User program compilation pipeline (`--target=user`)

Missing for a usable OS:
- Cannot run programs from the shell
- Cannot spawn processes from userland
- Cannot create/delete files
- Shell is baked into kernel, not loaded from filesystem

## Goal

A self-hosting kernel where userland (shell, utilities) lives on QFS and can be
modified without recompiling the kernel.

---

## Phase 1: Execute Programs from Shell

Enable `shell$ /path/to/program` to load and run executables from QFS.

### 1.1 Implement Binary Loading from QFS

Currently `_load_program()` in `kernel.qll` loads from debug peripheral. Need:

- [ ] `kernel::load_executable(path: string): *process` - Load binary from QFS
  - Open file with EXEC flag check
  - Read binary into allocated pages
  - Parse binary header for sizing (currently hardcoded 4KB)
  - Create process with memory layout
  - Return process pointer or null on failure

### 1.2 Add `run` Command to Shell

- [ ] `cmd_run(path)` - Execute a program and wait for completion
  - Load executable via `load_executable()`
  - Add process to scheduler
  - Wait for process to exit (blocking)
  - Print exit code

### 1.3 Testing

- [ ] Create disk image with `hello-a.qbin` marked executable
- [ ] Boot kernel with `--disk`, run `ls`, see `hello-a`
- [ ] Run `hello-a` from shell, see output

---

## Phase 2: Spawn Syscall (Non-blocking Exec)

Allow user programs to spawn children.

### 2.1 Implement `_spawn()` Syscall

```
SPAWN (0x7): r1 = path pointer
Returns: child PID or -1 on failure
```

- [ ] Translate path from user space
- [ ] Load executable from QFS
- [ ] Create child process (parent = current process)
- [ ] Enqueue child in scheduler
- [ ] Return child PID

### 2.2 Add WAIT Syscall

```
WAIT (0x8): r1 = PID (or 0 for any child)
Returns: exit code of child, -1 if no children
```

- [ ] Track child exit codes in process table
- [ ] Block parent until child exits
- [ ] Return exit code

### 2.3 Update User Library

- [ ] `lib::spawn(path: string): byte` - wrapper for SPAWN
- [ ] `lib::wait(pid: byte): byte` - wrapper for WAIT

---

## Phase 3: File Creation/Deletion

### 3.1 Implement `_create()` Syscall

```
CREATE (0x5): r1 = path, r2 = flags (EXEC bit)
Returns: 0 on success, -1 on failure
```

- [ ] Validate path
- [ ] Call `fs::qfs::dir_create()` with appropriate flags
- [ ] Return result

### 3.2 Implement `_destroy()` Syscall

```
DESTROY (0x6): r1 = path
Returns: 0 on success, -1 on failure
```

- [ ] Validate path
- [ ] Call `fs::qfs::dir_delete()`
- [ ] Return result

### 3.3 Shell Commands

- [ ] `touch <filename>` - create empty file
- [ ] `rm <filename>` - delete file
- [ ] `write <filename>` - write stdin to file (or simple text)

---

## Phase 4: Shell from Filesystem

Move shell out of kernel and load it as the init process.

### 4.1 Create Standalone Shell

- [ ] Port `kernel/shell.qll` to user program using `lib::*` syscalls
- [ ] Use `lib::open/read/write/close` for file I/O
- [ ] Use `lib::spawn/wait` for running programs
- [ ] Compile as `shell.qbin`

### 4.2 Kernel Init Process

- [ ] Kernel boots, initializes subsystems
- [ ] Load `/shell` (or `/init`) from QFS as PID 1
- [ ] Jump to scheduler
- [ ] When PID 1 exits, halt or restart

### 4.3 Minimal Kernel Shell Fallback

- [ ] If no `/init` found, run built-in emergency shell
- [ ] Emergency shell can `fsck`, `mount`, etc.

---

## Phase 5: Expand Root Directory

Currently limited to 4 entries (1 sector).

### 5.1 Chainable Root Directory

- [ ] Implement root directory FAT chain in `fs.qll`
- [ ] `dir_find()` follows chain
- [ ] `dir_create()` allocates new sector when full
- [ ] Update `ls` to iterate all sectors

---

## Phase 6: Hierarchical Directories (Optional)

QFS v2 spec supports directories but kernel doesn't implement them.

### 6.1 Path Parsing

- [ ] `_parse_path(path)` - split `/foo/bar/baz` into components

### 6.2 Directory Traversal

- [ ] `dir_lookup(parent_sector, name)` - find entry in directory
- [ ] `dir_resolve(path)` - resolve full path to dirent

### 6.3 Update Syscalls

- [ ] OPEN/CREATE/DESTROY support full paths
- [ ] Shell `cd`, `mkdir` commands

---

## Implementation Order

```
Phase 1.1 → 1.2 → 1.3 (run programs from shell)
    ↓
Phase 2.1 → 2.2 → 2.3 (spawn/wait syscalls)
    ↓
Phase 3   (create/delete files)
    ↓
Phase 4   (shell from filesystem)
    ↓
Phase 5   (grow root directory)
    ↓
Phase 6   (hierarchical directories)
```

Start with Phase 1 - it provides immediate feedback and proves the critical
path: filesystem → binary loading → process creation → execution.

---

## Testing Strategy

Each phase should have:
1. A test program compiled to `kernel/tests/`
2. A disk image created with `qfs create --from`
3. A manual test script or documented qvm invocation

Example for Phase 1:
```bash
# Build test programs
cd kernel/tests && ./build.sh

# Create disk image with test programs
bun run bin/qfs.ts create test.img --sectors 256
bun run bin/qfs.ts add test.img kernel/tests/hello-a.qbin --exec --name hello-a

# Build and run kernel
cd kernel && ./build.sh
bun run bin/qvm.ts kernel.qbin --disk test.img

# In shell:
$ ls
hello-a  512 bytes
$ run hello-a
AAAA...
```

---

## Notes

- Binary header parsing: Currently hardcoded 4KB executable size. Real binaries
  should have a header with segment sizes.
- Memory: Bump allocator can't free. Works for now but limits long-running
  sessions.
- Process limits: 32 processes max, 8 open files. Fine for initial development.
