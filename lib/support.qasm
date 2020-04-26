;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Assembly-level support for the Quinix standard library.
;
; NOTE: there's no operating system yet, so this is just a sketch.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
@global::lib::support::syscall:
  store r63 r0      ; Store return.
  sub r63 r63 r62

  mov r0 r63       ; Get syscall.
  constant r1 0x2
  add r0 r0 r1
  load r0 r0

  constant r1 0x80  ; Trigger 0x80 interrupt; return will be in `r0`.
  int r1

  add r63 r63 r62   ; Get return address and return.
  load r1 r63
  jmp r1

@global::lib::support::syscall1:
  store r63 r0      ; Store return.
  sub r63 r63 r62

  mov r0 r63        ; Get syscall in r0.
  constant r1 0x3
  add r0 r0 r1
  load r0 r0

  mov r1 r63        ; Get argument in r1
  constant r2 0x2
  add r1 r1 r2
  load r1 r1

  constant r2 0x80  ; Trigger 0x80 interrupt; return will be in `r0`.
  int r2

  add r63 r63 r62   ; Get return address and return.
  load r1 r63
  jmp r1

@global::lib::support::syscall2:
  store r63 r0      ; Store return.
  sub r63 r63 r62

  mov r0 r63        ; Get syscall in r0.
  constant r1 0x4
  add r0 r0 r1
  load r0 r0

  mov r1 r63        ; Get argument 1 in r1
  constant r2 0x3
  add r1 r1 r2
  load r1 r1

  mov r2 r63        ; Get argument 2 in r2
  constant r3 0x2
  add r2 r2 r3
  load r2 r2

  constant r3 0x80  ; Trigger 0x80 interrupt; return will be in `r0`.
  int r3

  add r63 r63 r62   ; Get return address and return.
  load r1 r63
  jmp r1
