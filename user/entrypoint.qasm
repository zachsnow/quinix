; Usermode entrypoint
; Sets up ONE, calls global init, calls main, exits via syscall.
; Assumes kernel has already set SP.
@_entrypoint:
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

  ; EXIT syscall with main's return value
  mov r1 r0                 ; r1 = exit code (main's return value)
  constant r0 0x0           ; r0 = EXIT syscall number
  constant r2 0x80
  int r2

  ; Should not reach here
  halt
