; Halt the machine.
@global::kernel::support::halt:
  mov r1 r0       ; Put return address in r1 for reference.
  add r2 r63 r62  ; Get first argument; it's the error code.
  load r0 r2      ; Put in return register.
  halt

; Wait for interrupts.
@global::kernel::support::wait:
  store r63 r0      ; Save return address.
  sub r63 r63 r62
  wait
  add r63 r63 r62   ; Restore return address
  load r1 r63
  constant r0 0     ; Return value: 0.
  jmp r1            ; Return.

; Set an interrupt handler.
@global::kernel::support::interrupt:
  constant r1 0x2   ;
  add r1 r63 r1     ; Argument 1: handler pointer.
  load r1 r1

  add r2 r63 r62    ; Argument 2: interrupt number.
  load r2 r2

  constant r3 0x101 ; Interrupt base.
  add r3 r3 r2      ; Interrupt handler address.
  store r3 r1       ; Update handler.

  jmp r0            ; Return.
