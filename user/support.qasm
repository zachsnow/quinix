;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Assembly-level support for the Quinix standard library.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
@global::lib::support::debugger:
  constant r1 0x3
  int r1
  jmp r0

; Stack layout after caller pushes 1 arg and we push return:
;   SP + 0: return address
;   SP + 1: syscall
@global::lib::support::syscall:
  sub r63 r63 r62   ; Push return address (QLL convention: sub then store)
  store r63 r0

  mov r0 r63        ; Get syscall from SP + 1
  constant r1 0x1
  add r0 r0 r1
  load r0 r0

  constant r1 0x80  ; Trigger 0x80 interrupt; return will be in `r0`.
  int r1

  load r1 r63       ; Get return address and return.
  add r63 r63 r62
  jmp r1

; Stack layout after caller pushes 2 args and we push return:
;   SP + 0: return address
;   SP + 1: arg0
;   SP + 2: syscall
@global::lib::support::syscall1:
  sub r63 r63 r62   ; Push return address (QLL convention: sub then store)
  store r63 r0

  mov r0 r63        ; Get syscall from SP + 2
  constant r1 0x2
  add r0 r0 r1
  load r0 r0

  mov r1 r63        ; Get arg0 from SP + 1
  add r1 r1 r62
  load r1 r1

  constant r2 0x80  ; Trigger 0x80 interrupt; return will be in `r0`.
  int r2

  load r1 r63       ; Get return address and return.
  add r63 r63 r62
  jmp r1

; Stack layout after caller pushes 3 args and we push return:
;   SP + 0: return address
;   SP + 1: arg1 (data pointer)
;   SP + 2: arg0 (handle)
;   SP + 3: syscall
@global::lib::support::syscall2:
  sub r63 r63 r62   ; Push return address (QLL convention: sub then store)
  store r63 r0

  mov r0 r63        ; Get syscall from SP + 3
  constant r1 0x3
  add r0 r0 r1
  load r0 r0

  mov r1 r63        ; Get arg0 (handle) from SP + 2
  constant r2 0x2
  add r1 r1 r2
  load r1 r1

  mov r2 r63        ; Get arg1 (data) from SP + 1
  add r2 r2 r62
  load r2 r2

  constant r3 0x80  ; Trigger 0x80 interrupt; return will be in `r0`.
  int r3

  load r1 r63       ; Get return address and return.
  add r63 r63 r62
  jmp r1
