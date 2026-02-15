; @expect: 1
; Unsigned lt says 0xFFFFFFFF > 1, but signed lt says -1 < 1.
; Verify slt and lt disagree on the same operands.
constant r1 0xFFFFFFFF
constant r2 1
lt r3 r1 r2         ; unsigned: 0xFFFFFFFF > 1, so r3 = 0
slt r4 r1 r2        ; signed: -1 < 1, so r4 = 1
neq r0 r3 r4        ; they should differ
halt
