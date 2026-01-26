; Baremetal entrypoint
; Sets up SP and ONE, calls global init, calls main, halts.
@_entrypoint:
  constant r63 0xFFFFF      ; SP = top of 1MB memory
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
