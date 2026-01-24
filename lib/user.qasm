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
;   3. Triggers EXIT syscall with main's return value

@user_entrypoint$:
  ; Initialize ONE register (required for QLL calling convention)
  constant r62 0x0001

  ; Call main
  constant r1 @global::main
  constant r0 @user_main_return$
  jmp r1

@user_main_return$:
  ; r0 contains main's return value
  ; Syscall convention: r0 = syscall number, r1 = arg0
  mov r1 r0           ; r1 = exit code (main's return value)
  constant r0 0x0000  ; r0 = EXIT syscall (0)
  constant r2 0x0080  ; syscall interrupt
  int r2

  ; Should not reach here
  halt
