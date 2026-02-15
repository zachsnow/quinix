; @expect: 141
; Simulate stack at 0x4000 using r10 as stack pointer
constant r10 0x4000
constant r1 1

; Push 42
constant r2 42
sub r10 r10 r1
store r10 r2

; Push 99
constant r2 99
sub r10 r10 r1
store r10 r2

; Pop into r3 (should be 99)
load r3 r10
add r10 r10 r1

; Pop into r4 (should be 42)
load r4 r10
add r10 r10 r1

; Verify: r0 = r3 + r4 = 99 + 42 = 141
add r0 r3 r4
halt
