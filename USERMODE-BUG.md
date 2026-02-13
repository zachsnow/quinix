# Usermode Binary Execution Bug

## Summary

User binaries loaded by the kernel shell (`run /bin/hello.qbin`) never execute.
The scheduler switches to the user task but no user code runs — no output, no
syscalls, no faults.

## Steps to reproduce

```bash
./build.sh --all
(sleep 1; echo "run /bin/hello.qbin") | timeout 15 bun run bin/qvm.ts kernel/kernel.qbin --disk image/disk.qfs -s
```

## Expected behavior

The user program prints "Hello from userspace!" and exits.

## Actual behavior

The kernel creates the process and the scheduler switches to the user task,
then nothing happens. The VM burns through cycles silently until killed.

```
process: creating process struct
process: enqueuing task
process: created process
load: process created
scheduler: timer interrupt
scheduler: switching to task
<--- hangs here --->
```

## Observations

1. Kernel boot, shell, filesystem, process creation all work correctly.
2. After the scheduler switches tasks, all subsequent timer interrupts are
   ignored with "interrupts disabled".
3. The verbose trace (`--verbose -c 5500000`) shows:
   - No "interrupt 0x0: return" messages after the task switch.
   - No FAULT messages.
   - Only 2 timer interrupt attempts, both ignored as "interrupts disabled".
4. Stats show `interrupts handled: 1` (the timer that triggered the switch)
   and `interrupts ignored: 4-53` (all subsequent timers).
5. The bug reproduces at HEAD and at 998c62b ("Fix interrupt stack corruption
   by switching to kernel stack in trampolines").

## Analysis

The timer interrupt handler flow is:

1. Timer fires → `prepareInterrupt(TIMER)` → stores registers, disables
   interrupts, disables MMU, jumps to timer trampoline.
2. Trampoline switches to kernel stack, calls `_timer_interrupt`.
3. Scheduler saves current task state, restores user task state
   (IP=0x1000, SP=top of stack) to `*interrupts::state` at address 0x2.
4. Trampoline does `INT 0x0` (return).
5. VM's `prepareInterrupt(RETURN)` should: restore registers from 0x2,
   re-enable interrupts, re-enable MMU.
6. User task should execute at virtual IP 0x1000.

The fact that interrupts remain disabled after step 4 suggests either:

- The INT 0x0 in the trampoline never executes (trampoline stuck or crashing).
- INT 0x0 executes but `interruptRestore()` restores an IP of 0, triggering
  "invalid interrupt return" fault — but we don't see that in verbose output.
- The user task starts but immediately faults, which disables interrupts. The
  error handler would log "process: error interrupt!" but we don't see that
  either.
- Something else prevents the trampoline from reaching `INT 0x0`.

## Next steps

- Set a breakpoint at the timer trampoline's `INT 0x0` to verify it executes.
- Dump the interrupt state at address 0x2 after the scheduler writes it to
  verify the user task's IP/SP are correct.
- Check if the MMU page table is correctly rebuilt when `mmu.enable()` is
  called during INT 0x0 return.
