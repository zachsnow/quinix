; @expect: 3
; Signed division: -7 / -2 = 3
; -7 = 0xFFFFFFF9, -2 = 0xFFFFFFFE
constant r1 0xFFFFFFF9
constant r2 0xFFFFFFFE
sdiv r0 r1 r2
halt
