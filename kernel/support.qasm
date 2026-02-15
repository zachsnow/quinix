; Kernel entrypoint
; Sets up SP and ONE, calls global init, calls main, halts.
@_entrypoint:
  constant r63 0x3FFFFF     ; SP = top of 4MB memory
  constant r62 0x1          ; ONE = 1

  ; Call global init
  constant r0 @_after_init
  constant r1 @global::_init
  jmp r1
@_after_init:

  ; Call main
  constant r0 @_after_main
  constant r1 @global::main
  jmp r1
@_after_main:

  ; Halt with main's return value in r0
  halt

; Kernel stack address for interrupt handlers.
; When an interrupt fires from userspace, SP contains the user's virtual stack
; address. With MMU disabled, using this as a physical address corrupts memory.
; Interrupt handlers must switch to this kernel stack at the start.
; Located at 0x1FF00 (between kernel code and heap at 0x20000).
data @kernel_interrupt_sp 0x1FF00

; Interrupt trampoline for syscall handler.
; This wrapper switches to the kernel stack BEFORE calling the QLL handler,
; ensuring that the handler's prologue and stack operations use kernel memory.
@global::kernel::support::syscall_trampoline:
  ; Switch to kernel interrupt stack (before any stack operations!)
  constant r63 @kernel_interrupt_sp
  load r63 r63
  ; Now call the actual QLL syscall handler
  constant r0 @_syscall_return
  constant r1 @global::kernel::syscall::_syscall_interrupt
  jmp r1
@_syscall_return:
  ; Handler returned, now return from interrupt
  ; INT 0x0 restores all registers from interrupt state at 0x2
  constant r0 0x0
  int r0

; Interrupt trampoline for timer handler.
@global::kernel::support::timer_trampoline:
  constant r63 @kernel_interrupt_sp
  load r63 r63
  constant r0 @_timer_return
  constant r1 @global::kernel::scheduler::_timer_interrupt
  jmp r1
@_timer_return:
  constant r0 0x0
  int r0

; Interrupt trampoline for error handler.
@global::kernel::support::error_trampoline:
  constant r63 @kernel_interrupt_sp
  load r63 r63
  constant r0 @_error_return
  constant r1 @global::kernel::process::_error_interrupt
  jmp r1
@_error_return:
  constant r0 0x0
  int r0

; Disable interrupts (write false to address 0x0).
@global::kernel::support::disable_interrupts:
  constant r1 0x0000        ; Address 0x0 is interrupt enable flag.
  constant r2 0x0000        ; false
  store r1 r2
  jmp r0                    ; Return.

; Enable interrupts (write true to address 0x0).
@global::kernel::support::enable_interrupts:
  constant r1 0x0000        ; Address 0x0 is interrupt enable flag.
  constant r2 0x0001        ; true
  store r1 r2
  jmp r0                    ; Return.

; Halt the machine.
@global::kernel::support::halt:
  mov r1 r0               ; Put return address in r1 for reference.
  mov r2 r63              ; Get first argument; it's the error code.
  load r0 r2              ; Put in return register.
  halt

; Wait for interrupts (does not return).
@global::kernel::support::wait:
  wait
  constant r0 0xffffffff  ; Error -- we should never reach this point.
  halt

; Wait for an interrupt and then return.
@global::kernel::support::wait_for_interrupt:
  wait
  jmp r0                  ; Return after interrupt.

; Set an interrupt handler; the address given *must*
; correspond to interrupt pointer, not a function pointer.
@global::kernel::support::interrupt:
  add r1 r63 r62          ; Argument 1: interrupt number.
  load r1 r1

  mov r2 r63              ; Argument 2: handler address.
  load r2 r2

  constant r3 0x1         ; Interrupt table pointer address.
  load r3 r3              ; Interrupt table address.
  add r3 r3 r1            ; Interrupt handler entry address.
  store r3 r2             ; Update handler entry.

  ; Update the interrupt count to ensure high interrupts (like syscall 0x80) are mapped.
  ; The count must be at least as high as the highest interrupt number used.
  constant r5 0x44        ; Count address (REGISTER_COUNT + 3, after fault reason).
  constant r6 0x80        ; Ensure count >= 128 for syscalls.
  store r5 r6             ; Update count.

  jmp r0                  ; Return.
