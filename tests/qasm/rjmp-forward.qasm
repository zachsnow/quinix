; @expect: 0
; rjmp forward skips over instructions
constant r0 0
constant r1 3
rjmp r1
constant r0 0xDEAD
halt
