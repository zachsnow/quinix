; Invoke some interrupts.

; Interrupt 0x1 will release the event loop.
constant r1 0x1
int r1

; Interrupt 0x3 will trigger the debugger if the VM is run with `--inspect`.
constant r1 0x3
int r1

; Interrupt 0x0 really means "interrupt return" and will trigger
; a fault since we aren't in an interrupt handler.
constant r1 0x0
int r1

halt