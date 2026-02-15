; @expect: 0xDEAD
; Interrupt return restores registers

; --- Handler at 0x500: set r5=0, int r5 (return) ---
; constant r5 0
constant r10 0x500
constant r11 0x05050000    ; constant r5
store r10 r11
constant r10 0x501
constant r11 0x00000000    ; immediate 0
store r10 r11
; int r5
constant r10 0x502
constant r11 0x01000500    ; int sr0=r5
store r10 r11

; --- Set up interrupt table ---
constant r1 0x01
load r3 r1
constant r4 0x2
add r3 r3 r4
constant r2 0x500
store r3 r2

constant r1 0x44
constant r2 0x2
store r1 r2

; --- Set r0 = 0xDEAD, trigger interrupt, verify restore ---
constant r0 0xDEAD
constant r1 2
int r1

; After return, r0 should be restored to 0xDEAD
halt
