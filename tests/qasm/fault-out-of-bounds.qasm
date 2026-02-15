; @expect: 4
; Out-of-bounds load triggers fault handler with reason OUT_OF_BOUNDS (0x04)

; Write fault handler at 0x500: read fault reason and halt with it
constant r1 0x500
constant r2 0x05000000    ; constant r0
store r1 r2
constant r1 0x501
constant r2 0x43          ; fault reason address
store r1 r2
constant r1 0x502
constant r2 0x02000000    ; load r0 r0
store r1 r2
constant r1 0x503
constant r2 0x00000000    ; halt
store r1 r2

; Set up interrupt table: fault handler (interrupt 1) at 0x500
constant r1 0x01
load r3 r1
constant r4 0x1
add r3 r3 r4
constant r2 0x500
store r3 r2

constant r1 0x44
constant r2 0x1
store r1 r2

; Trigger fault: load from way beyond physical memory
constant r1 0x7FFFFFFF
load r0 r1
