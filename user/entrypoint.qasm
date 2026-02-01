; Usermode entrypoint
; Sets up ONE, calls global init, calls main with args, exits via syscall.
; Assumes kernel has already set:
;   SP (r63) = stack pointer (normal position, args data above SP)
;   r32 = pointer to args data (or 0 if no args)
;   r33 = length of args
; r32/r33 are callee-save (r32-r61) and will be preserved across _init.
@_entrypoint:
  constant r62 0x1          ; ONE = 1

  ; Call global init (r32/r33 are callee-save and will be preserved)
  constant r0 @_after_init
  constant r1 @global::_init
  jmp r1
@_after_init:

  ; Build slice descriptor for args and push onto stack.
  ; Slice layout: [pointer][length][capacity]
  ; Stack grows down, so push in reverse order (capacity first).
  ; r32 = args_ptr, r33 = args_len
  ; Push capacity (same as length for args)
  sub r63 r63 r62           ; SP -= 1
  store r63 r33             ; [SP] = capacity
  ; Push length
  sub r63 r63 r62           ; SP -= 1
  store r63 r33             ; [SP] = length
  ; Push pointer
  sub r63 r63 r62           ; SP -= 1
  store r63 r32             ; [SP] = pointer

  ; Call main (args slice is now on stack as the argument)
  constant r0 @_after_main
  constant r1 @global::main
  jmp r1
@_after_main:

  ; Pop the args slice descriptor (3 words)
  add r63 r63 r62
  add r63 r63 r62
  add r63 r63 r62

  ; EXIT syscall with main's return value
  mov r1 r0                 ; r1 = exit code (main's return value)
  constant r0 0x0           ; r0 = EXIT syscall number
  constant r2 0x80
  int r2

  ; Should not reach here
  halt
