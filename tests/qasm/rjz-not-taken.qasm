; @expect: 0xFF
; rjz does not jump when r0!=0, falls through to set r0=0xFF
constant r0 1
constant r1 2
rjz r0 r1
constant r0 0xFF
halt
