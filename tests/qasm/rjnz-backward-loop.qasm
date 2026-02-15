; @expect: 5
; rjnz backward loop counts to 5
; r0 = counter, r1 = 1, r2 = limit (5), r3 = offset (-2 as unsigned)
constant r0 0
constant r1 1
constant r2 5
constant r3 0xFFFFFFFE
add r0 r0 r1
sub r2 r2 r1
rjnz r2 r3
halt
