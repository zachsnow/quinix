; @expect: 55
; Compute fib(10) = 55
; r0=a (prev), r1=b (curr), r2=counter, r3=target, r4=1
constant r0 0
constant r1 1
constant r2 0
constant r3 10
constant r4 1
@loop:
  add r5 r0 r1
  mov r0 r1
  mov r1 r5
  add r2 r2 r4
  neq r6 r2 r3
  constant r7 @loop
jnz r6 r7
; After 10 iterations: r0=fib(10)=55, r1=fib(11)=89
halt
