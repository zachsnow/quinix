; @expect: 0xFFFFFFFC
; Arithmetic shift right preserves sign bit.
; -8 >> 1 = -4 (sign-extending)
; -8 = 0xFFFFFFF8, -4 = 0xFFFFFFFC
constant r1 0xFFFFFFF8
constant r2 1
sar r0 r1 r2
halt
