; Prints "Hello, world!"

data @hello 'Hello world!\n'
data @consoleControl 0x302
data @consoleBuffer 0x303

constant r0 @hello
constant r1 @consoleBuffer
load r1 r1
constant r2 0x1

; Copy to console buffer.
@copy:
load r3 r0
store r1 r3
add r0 r0 r2
add r1 r1 r2
constant r4 @copy
jnz r3 r4

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

; Exit.
@exit:
constant r0 0x2a ; Return 42 for fun.
mov r0 r0
halt
