; @expect: 1
; @cycles: 300
; Fault handler reads fault reason from 0x43, stores it at 0x700, returns it in r0

; --- Write fault handler code at 0x500 ---
; constant r1 0x43
constant r10 0x500
constant r11 0x05010000
store r10 r11
constant r10 0x501
constant r11 0x43
store r10 r11
; load r1 r1
constant r10 0x502
constant r11 0x02010100
store r10 r11
; constant r2 0x700
constant r10 0x503
constant r11 0x05020000
store r10 r11
constant r10 0x504
constant r11 0x700
store r10 r11
; store r2 r1
constant r10 0x505
constant r11 0x04020100
store r10 r11
; mov r0 r1
constant r10 0x506
constant r11 0x04000100
store r10 r11
; halt
constant r10 0x507
constant r11 0x00000000
store r10 r11

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

; --- Trigger fault: invalid instruction ---
constant r1 0x600
constant r2 0xFFFFFFFF
store r1 r2
constant r1 0x600
jmp r1
