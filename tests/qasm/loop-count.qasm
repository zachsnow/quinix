; @expect: 10
; Count to 10: r0 = counter, r1 = target, r2 = 1
constant r0 0
constant r1 10
constant r2 1
@loop:
  add r0 r0 r2
  neq r3 r0 r1
  constant r4 @loop
jnz r3 r4
halt
