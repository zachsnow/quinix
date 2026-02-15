; @expect: 1
; Signed greater than: 1 > -1 (0xFFFFFFFF)
constant r1 1
constant r2 0xFFFFFFFF
sgt r0 r1 r2
halt
