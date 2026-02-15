; @expect: 1
; Invalid instruction triggers fault handler with reason INVALID_INSTRUCTION (0x01)

; --- Write fault handler code at 0x500 ---
; constant r0 0x43
constant r1 0x500
constant r2 0x05000000
store r1 r2
; immediate 0x43
constant r1 0x501
constant r2 0x43
store r1 r2
; load r0 r0
constant r1 0x502
constant r2 0x02000000
store r1 r2
; halt
constant r1 0x503
constant r2 0x00000000
store r1 r2

; --- Set up interrupt table ---
constant r1 0x01
load r3 r1
constant r4 0x1
add r3 r3 r4
constant r2 0x500
store r3 r2

constant r1 0x44
constant r2 0x1
store r1 r2

; --- Trigger fault: write invalid instruction to 0x600 and jump to it ---
constant r1 0x600
constant r2 0xFFFFFFFF
store r1 r2
constant r1 0x600
jmp r1
