; @expect: 1
; Signed greater than with two negatives: -1 > -100
constant r1 0xFFFFFFFF
constant r2 0xFFFFFF9C
sgt r0 r1 r2
halt
