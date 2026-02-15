; @expect: 0xBEEF
; Software interrupt dispatches to handler

; --- Write handler at 0x500: constant r0 0xBEEF / halt ---
constant r10 0x500
constant r11 0x05000000    ; constant r0
store r10 r11
constant r10 0x501
constant r11 0xBEEF
store r10 r11
constant r10 0x502
constant r11 0x00000000    ; halt
store r10 r11

; --- Set up interrupt table ---
constant r1 0x01
load r3 r1                 ; r3 = entries table address
constant r4 0x2
add r3 r3 r4              ; entries[2]
constant r2 0x500
store r3 r2

constant r1 0x44
constant r2 0x2
store r1 r2                ; handler count = 2

; --- Trigger interrupt 2 ---
constant r1 2
int r1

; Should never reach here
constant r0 0xFF
halt
