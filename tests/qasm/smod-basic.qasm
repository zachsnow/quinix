; @expect: 0xFFFFFFFF
; Signed modulo: -7 % 2 = -1 (sign follows dividend)
; -7 = 0xFFFFFFF9, -1 = 0xFFFFFFFF
constant r1 0xFFFFFFF9
constant r2 2
smod r0 r1 r2
halt
