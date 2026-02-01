; Echoes one line of input.

data @outputControl 0x303
data @outputBuffer 0x303
data @inputControl 0x403
data @inputBuffer 0x404

constant r0 @inputControl
load r0 r0
constant r1 0x1
store r0 r1

; Wait for the write to complete.
@wait:
constant r0 0x1
int r0

constant r0 @inputControl
load r0 r0
load r0 r0
constant r1 @wait
jnz r0 r1

; Copy input buffer to output buffer.
constant r0 @inputBuffer
load r0 r0
constant r1 @outputBuffer
load r1 r1
constant r2 0x1

; Copy to output buffer.
@copy:
load r3 r0
store r1 r3
add r0 r0 r2
add r1 r1 r2
constant r4 @copy
jnz r3 r4

; Add newline.
data @newline '\n'
constant r3 @newline
load r3 r3
sub r1 r1 r2
store r1 r3
add r1 r1 r2
constant r3 0x0
store r1 r3

; Trigger write.
constant r0 @outputControl
load r0 r0
constant r1 0x1
store r0 r1

; Wait for the write to complete.
@wait2:
constant r0 0x1
int r0

constant r0 @outputControl
load r0 r0
load r0 r0
constant r1 @wait2
jnz r0 r1

halt

