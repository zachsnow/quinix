; @expect: 1
; Signed less than: 0xFFFFFFFF is -1 signed, so -1 < 1
constant r1 0xFFFFFFFF
constant r2 1
slt r0 r1 r2
halt
