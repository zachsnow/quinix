; @expect: 10
; Compute (2.0 * 3.0) + 4.0 = 10.0, then convert to int
; Float bit patterns: 2.0=0x40000000, 3.0=0x40400000, 4.0=0x40800000
constant r1 0x40000000
constant r2 0x40400000
fmul r3 r1 r2      ; r3 = 6.0
constant r4 0x40800000
fadd r3 r3 r4      ; r3 = 10.0
ftoi r0 r3          ; r0 = 10
halt
