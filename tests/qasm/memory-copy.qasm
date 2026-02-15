; @expect: 0xCC
; Write 3 words to 0x2000, copy to 0x3000, read back last one
constant r0 0x2000
constant r1 0xAA
store r0 r1
constant r0 0x2001
constant r1 0xBB
store r0 r1
constant r0 0x2002
constant r1 0xCC
store r0 r1

; Copy loop: r2=src, r3=dst, r4=count, r5=1
constant r2 0x2000
constant r3 0x3000
constant r4 3
constant r5 1
@copy:
  load r6 r2
  store r3 r6
  add r2 r2 r5
  add r3 r3 r5
  sub r4 r4 r5
  constant r7 @copy
jnz r4 r7

; Read back last copied word
constant r0 0x3002
load r0 r0
halt
