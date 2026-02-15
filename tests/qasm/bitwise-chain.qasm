; @expect: 0xF0F0
constant r0 0xFF00
constant r1 0x0FF0
and r2 r0 r1       ; 0x0F00
constant r3 0x000F
or r2 r2 r3        ; 0x0F0F
constant r4 4
shl r2 r2 r4       ; 0xF0F0
shr r2 r2 r4       ; 0x0F0F
not r2 r2          ; 0xFFFFF0F0
constant r5 0xFFFF
and r0 r2 r5       ; 0xF0F0
halt
