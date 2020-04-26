; Prints "Tick..." every second or so.
data @hello 'Tick...\n'

data @interruptTable 0x1              ; Address of containing the address of the interrupt handler entries table.
data @interrupt 0x2                   ; Hardware timer is interrupt 0x2.
data @timerControl 0x300              ; Hardware timer MMIO location.
data @consoleControl 0x302            ; Console output MMIO location.
data @consoleBuffer 0x303             ; Console output DMA location.

; Set up interrupt handler.
constant r0 @interruptTable
load r0 r0
load r0 r0
constant r1 @interrupt
load r1 r1
add r0 r0 r1
constant r1 @int
store r0 r1

; Start timer.
constant r0 @timerControl
load r0 r0
constant r1 0x400
store r0 r1
wait

; Interrupt handler.
@int:
constant r0 @hello
constant r1 @consoleBuffer
load r1 r1
constant r2 0x1

; Get number of bytes to copy -- length of string + 1.
load r5 r0
add r5 r5 r2
constant r6 0x0

; Copy to console buffer.
@copy:
load r3 r0
store r1 r3
add r0 r0 r2
add r1 r1 r2
add r6 r6 r2
eq r7 r5 r6
constant r4 @copy
jnz r7 r4

; Trigger write.
constant r0 @consoleControl
load r0 r0
constant r1 0x1
store r0 r1

; Wait for the write to complete.
@wait:
constant r0 0x1
int r0

constant r0 @consoleControl
load r0 r0
load r0 r0
constant r1 @wait
jnz r0 r1

; Complete interrupt.
constant r0 0x0
int r0
