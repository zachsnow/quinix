; @expect: 1
; Unsigned division and modulo: 17 / 5 = 3, 17 % 5 = 2, 3 + 2 = 5
; Verify both div and mod by combining results.
constant r1 17
constant r2 5
div r3 r1 r2        ; 3
mod r4 r1 r2        ; 2
; Reconstruct: (quotient * divisor) + remainder = dividend
mul r5 r3 r2        ; 3 * 5 = 15
add r6 r5 r4        ; 15 + 2 = 17
eq r0 r6 r1         ; should be equal
halt
