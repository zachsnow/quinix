; @expect: 0
; rjz jumps when r0=0, skipping over constant r0 0xFF
constant r0 0
constant r1 2
rjz r0 r1
constant r0 0xFF
halt
