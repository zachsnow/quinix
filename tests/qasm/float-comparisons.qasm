; @expect: 7
; Float comparisons: feq, flt, fgt
; 1.0=0x3F800000, 2.0=0x40000000
; Accumulate a bitmask in r0: bit0=feq, bit1=flt, bit2=fgt
constant r1 0x3F800000
constant r2 0x40000000
constant r5 0x3F800000

; feq: 1.0 == 1.0 -> 1
feq r3 r1 r5
constant r0 0
or r0 r0 r3          ; bit 0

; flt: 1.0 < 2.0 -> 1
flt r3 r1 r2
constant r4 1
shl r3 r3 r4
or r0 r0 r3          ; bit 1

; fgt: 2.0 > 1.0 -> 1
fgt r3 r2 r1
constant r4 2
shl r3 r3 r4
or r0 r0 r3          ; bit 2

halt
