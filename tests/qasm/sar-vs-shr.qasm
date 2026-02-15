; @expect: 1
; SAR and SHR differ on negative numbers.
; 0x80000000 >> 1: SHR gives 0x40000000, SAR gives 0xC0000000
constant r1 0x80000000
constant r2 1
shr r3 r1 r2        ; logical: 0x40000000
sar r4 r1 r2        ; arithmetic: 0xC0000000
neq r0 r3 r4
halt
