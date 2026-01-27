; Bare minimum test program - just exits with code 42
@_bare_start:
  constant r62 0x1          ; ONE = 1
  ; EXIT syscall: r0 = syscall number (0), r1 = exit code (42)
  constant r0 0x0           ; EXIT syscall
  constant r1 0x2a          ; exit code 42
  constant r2 0x80          ; syscall interrupt
  int r2                    ; trigger syscall
  halt                      ; should not reach here
