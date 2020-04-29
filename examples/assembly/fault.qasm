; A program that causes a few different kinds of fault.
data @bad_location 0x10000000         ; An out-of-bounds memory location.
data @bad_instruction 0xffffffff      ; An invalid instruction.

data @interruptTable 0x1              ; Address of containing the address of the interrupt handler entries table.
data @interrupt 0x1                   ; Fault is interrupt 0x2.


; Set up interrupt handler.
constant r0 @interruptTable
load r0 r0
load r0 r0
constant r1 @interrupt
load r1 r1
add r0 r0 r1
constant r1 @simple_handler
store r0 r1

; Cause a memory error.
constant r1 @bad_location
load r1 r1
load r1 r1

; We should return to here due to the simple handler.
; Now replace the handler with a bad one.
constant r0 @interruptTable
load r0 r0
load r0 r0
constant r1 @interrupt
load r1 r1
add r0 r0 r1
constant r1 @bad_handler
store r0 r1

; Cause a memory error.
constant r1 @bad_location
load r1 r1
load r1 r1

; We should cause a double fault and not reach this point.
constant r0 42
halt

; Simple fault handler that just ignores the fault and returns.
@simple_handler:
constant r0 0x0
int r0

; Bad fault handler that itself causes a fault.
@bad_handler:
constant r1 @bad_location
load r1 r1
load r1 r1
constant r0 0x0
int r0
