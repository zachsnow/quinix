; Halt the machine.
@global::kernel::support::halt:
  mov r1 r0               ; Put return address in r1 for reference.
  mov r2 r63              ; Get first argument; it's the error code.
  load r0 r2              ; Put in return register.
  halt

; Wait for interrupts.
@global::kernel::support::wait:
  wait
  constant r0 0xffffffff  ; Error -- we should never reach this point.
  halt

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

  jmp r0                  ; Return.
