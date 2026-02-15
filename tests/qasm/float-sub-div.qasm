; @expect: 2
; Float subtraction and division: (10.0 - 4.0) / 3.0 = 2.0, then ftoi
; 10.0=0x41200000, 4.0=0x40800000, 3.0=0x40400000
constant r1 0x41200000
constant r2 0x40800000
fsub r3 r1 r2        ; 6.0
constant r4 0x40400000
fdiv r3 r3 r4        ; 2.0
ftoi r0 r3
halt
