; User-mode startup for kernel processes
; This is the entry point for user programs.
;
; The kernel sets up:
;   - r63 (SP) = top of stack
;   - IP = 0x1000 (this code)
;
; This code:
;   1. Initializes r62 (ONE) = 1
;   2. Calls main
;   3. Calls lib::exit with the return value

@user_entrypoint$:
  ; Initialize ONE register (required for QLL calling convention)
  constant r62 0x0001

  ; Call main
  constant r1 @global::main
  constant r0 @user_main_return$
  jmp r1

@user_main_return$:
  ; r0 contains main's return value
  ; Push return value as argument to exit
  sub r63 r63 r62
  store r63 r0

  ; Call lib::exit (this should not return)
  constant r1 @global::lib::exit
  constant r0 @user_exit_return$
  jmp r1

@user_exit_return$:
  ; If we get here, something went wrong
  halt
