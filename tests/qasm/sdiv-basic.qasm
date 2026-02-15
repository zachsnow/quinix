; @expect: 0xFFFFFFFD
; Signed division: -7 / 2 = -3 (truncates toward zero)
; -7 = 0xFFFFFFF9, -3 = 0xFFFFFFFD
constant r1 0xFFFFFFF9
constant r2 2
sdiv r0 r1 r2
halt
