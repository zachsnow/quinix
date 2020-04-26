@lib_data_1$:                                                           ; 0x1000
data @global::lib::support::EXIT_SYSCALL 0x00                           ; 0x1000
data @global::lib::support::DEBUGGER_SYSCALL 0x01                       ; 0x1001
data @global::lib::support::OPEN_SYSCALL 0x02                           ; 0x1002
data @global::lib::support::CLOSE_SYSCALL 0x03                          ; 0x1003
data @global::lib::support::READ_SYSCALL 0x04                           ; 0x1004
data @global::lib::support::WRITE_SYSCALL 0x05                          ; 0x1005
data @global::lib::GENERIC_ERROR 0x00                                   ; 0x1006 -- global global::lib::GENERIC_ERROR
constant r1 0x0001                                                      ; 0x1007
constant r2 0x0000                                                      ; 0x1009 -- -(1)
sub r1 r2 r1                                                            ; 0x100b
constant r2 @global::lib::GENERIC_ERROR                                 ; 0x100c -- reference global global::lib::GENERIC_ERROR
store r2 r1                                                             ; 0x100e -- store to global global::lib::GENERIC_ERROR
data @global::lib::debug_input_handle 0x01                              ; 0x100f
data @global::lib::debug_output_handle 0x02                             ; 0x1010
@lib_program_2$:                                                        ; 0x1011
@global::lib::open:                                                     ; 0x1011
@global::lib::open_start$:                                              ; 0x1011
sub r63 r63 r62                                                         ; 0x1011 -- push return address
store r63 r0                                                            ; 0x1012
mov r1 r63                                                              ; 0x1013 -- frame start
sub r63 r63 r62                                                         ; 0x1014 -- push frame start
store r63 r1                                                            ; 0x1015
constant r1 @global::lib::support::syscall1                             ; 0x1016 -- function address @global::lib::support::syscall1
constant r2 @global::lib::support::OPEN_SYSCALL                         ; 0x1018 -- global address @global::lib::support::OPEN_SYSCALL
load r2 r2                                                              ; 0x101a -- dereference @global::lib::support::OPEN_SYSCALL
load r4 r63                                                             ; 0x101b -- stack frame address
constant r3 0x0001                                                      ; 0x101c -- argument address filename
add r3 r4 r3                                                            ; 0x101e
load r3 r3                                                              ; 0x101f -- dereference filename
sub r63 r63 r62                                                         ; 0x1020 -- push argument
store r63 r2                                                            ; 0x1021
sub r63 r63 r62                                                         ; 0x1022 -- push argument
store r63 r3                                                            ; 0x1023
constant r0 @global::lib::open_1$                                       ; 0x1024 -- set up return address
jmp r1                                                                  ; 0x1026
@global::lib::open_1$:                                                  ; 0x1027 -- return address
mov r4 r0                                                               ; 0x1027
constant r1 0x0002                                                      ; 0x1028 -- pop arguments
add r63 r63 r1                                                          ; 0x102a
mov r0 r4                                                               ; 0x102b
constant r1 @global::lib::open_return$                                  ; 0x102c
jmp r1                                                                  ; 0x102e
@global::lib::open_return$:                                             ; 0x102f
load r63 r63                                                            ; 0x102f -- restore sp
load r1 r63                                                             ; 0x1030 -- pop return address
add r63 r63 r62                                                         ; 0x1031
jmp r1                                                                  ; 0x1032 -- return
@global::lib::open_end$:                                                ; 0x1033
@global::lib::close:                                                    ; 0x1033
@global::lib::close_start$:                                             ; 0x1033
sub r63 r63 r62                                                         ; 0x1033 -- push return address
store r63 r0                                                            ; 0x1034
mov r1 r63                                                              ; 0x1035 -- frame start
sub r63 r63 r62                                                         ; 0x1036 -- push frame start
store r63 r1                                                            ; 0x1037
constant r1 @global::lib::support::syscall1                             ; 0x1038 -- function address @global::lib::support::syscall1
constant r2 @global::lib::support::CLOSE_SYSCALL                        ; 0x103a -- global address @global::lib::support::CLOSE_SYSCALL
load r2 r2                                                              ; 0x103c -- dereference @global::lib::support::CLOSE_SYSCALL
load r4 r63                                                             ; 0x103d -- stack frame address
constant r3 0x0001                                                      ; 0x103e -- argument address handle
add r3 r4 r3                                                            ; 0x1040
load r3 r3                                                              ; 0x1041 -- dereference handle
sub r63 r63 r62                                                         ; 0x1042 -- push argument
store r63 r2                                                            ; 0x1043
sub r63 r63 r62                                                         ; 0x1044 -- push argument
store r63 r3                                                            ; 0x1045
constant r0 @global::lib::close_1$                                      ; 0x1046 -- set up return address
jmp r1                                                                  ; 0x1048
@global::lib::close_1$:                                                 ; 0x1049 -- return address
mov r4 r0                                                               ; 0x1049
constant r1 0x0002                                                      ; 0x104a -- pop arguments
add r63 r63 r1                                                          ; 0x104c
mov r0 r4                                                               ; 0x104d
constant r1 @global::lib::close_return$                                 ; 0x104e
jmp r1                                                                  ; 0x1050
@global::lib::close_return$:                                            ; 0x1051
load r63 r63                                                            ; 0x1051 -- restore sp
load r1 r63                                                             ; 0x1052 -- pop return address
add r63 r63 r62                                                         ; 0x1053
jmp r1                                                                  ; 0x1054 -- return
@global::lib::close_end$:                                               ; 0x1055
@global::lib::read:                                                     ; 0x1055
@global::lib::read_start$:                                              ; 0x1055
sub r63 r63 r62                                                         ; 0x1055 -- push return address
store r63 r0                                                            ; 0x1056
mov r1 r63                                                              ; 0x1057 -- frame start
sub r63 r63 r62                                                         ; 0x1058 -- push frame start
store r63 r1                                                            ; 0x1059
constant r1 @global::lib::support::syscall2                             ; 0x105a -- function address @global::lib::support::syscall2
constant r2 @global::lib::support::READ_SYSCALL                         ; 0x105c -- global address @global::lib::support::READ_SYSCALL
load r2 r2                                                              ; 0x105e -- dereference @global::lib::support::READ_SYSCALL
load r4 r63                                                             ; 0x105f -- stack frame address
constant r3 0x0002                                                      ; 0x1060 -- argument address handle
add r3 r4 r3                                                            ; 0x1062
load r3 r3                                                              ; 0x1063 -- dereference handle
load r5 r63                                                             ; 0x1064 -- stack frame address
constant r4 0x0001                                                      ; 0x1065 -- argument address buffer
add r4 r5 r4                                                            ; 0x1067
load r4 r4                                                              ; 0x1068 -- dereference buffer
sub r63 r63 r62                                                         ; 0x1069 -- push argument
store r63 r2                                                            ; 0x106a
sub r63 r63 r62                                                         ; 0x106b -- push argument
store r63 r3                                                            ; 0x106c
sub r63 r63 r62                                                         ; 0x106d -- push argument
store r63 r4                                                            ; 0x106e
constant r0 @global::lib::read_1$                                       ; 0x106f -- set up return address
jmp r1                                                                  ; 0x1071
@global::lib::read_1$:                                                  ; 0x1072 -- return address
mov r5 r0                                                               ; 0x1072
constant r1 0x0003                                                      ; 0x1073 -- pop arguments
add r63 r63 r1                                                          ; 0x1075
mov r0 r5                                                               ; 0x1076
constant r1 @global::lib::read_return$                                  ; 0x1077
jmp r1                                                                  ; 0x1079
@global::lib::read_return$:                                             ; 0x107a
load r63 r63                                                            ; 0x107a -- restore sp
load r1 r63                                                             ; 0x107b -- pop return address
add r63 r63 r62                                                         ; 0x107c
jmp r1                                                                  ; 0x107d -- return
@global::lib::read_end$:                                                ; 0x107e
@global::lib::write:                                                    ; 0x107e
@global::lib::write_start$:                                             ; 0x107e
sub r63 r63 r62                                                         ; 0x107e -- push return address
store r63 r0                                                            ; 0x107f
mov r1 r63                                                              ; 0x1080 -- frame start
sub r63 r63 r62                                                         ; 0x1081 -- push frame start
store r63 r1                                                            ; 0x1082
constant r1 @global::lib::support::syscall2                             ; 0x1083 -- function address @global::lib::support::syscall2
constant r2 @global::lib::support::WRITE_SYSCALL                        ; 0x1085 -- global address @global::lib::support::WRITE_SYSCALL
load r2 r2                                                              ; 0x1087 -- dereference @global::lib::support::WRITE_SYSCALL
load r4 r63                                                             ; 0x1088 -- stack frame address
constant r3 0x0002                                                      ; 0x1089 -- argument address handle
add r3 r4 r3                                                            ; 0x108b
load r3 r3                                                              ; 0x108c -- dereference handle
load r5 r63                                                             ; 0x108d -- stack frame address
constant r4 0x0001                                                      ; 0x108e -- argument address data
add r4 r5 r4                                                            ; 0x1090
load r4 r4                                                              ; 0x1091 -- dereference data
sub r63 r63 r62                                                         ; 0x1092 -- push argument
store r63 r2                                                            ; 0x1093
sub r63 r63 r62                                                         ; 0x1094 -- push argument
store r63 r3                                                            ; 0x1095
sub r63 r63 r62                                                         ; 0x1096 -- push argument
store r63 r4                                                            ; 0x1097
constant r0 @global::lib::write_1$                                      ; 0x1098 -- set up return address
jmp r1                                                                  ; 0x109a
@global::lib::write_1$:                                                 ; 0x109b -- return address
mov r5 r0                                                               ; 0x109b
constant r1 0x0003                                                      ; 0x109c -- pop arguments
add r63 r63 r1                                                          ; 0x109e
mov r0 r5                                                               ; 0x109f
constant r1 @global::lib::write_return$                                 ; 0x10a0
jmp r1                                                                  ; 0x10a2
@global::lib::write_return$:                                            ; 0x10a3
load r63 r63                                                            ; 0x10a3 -- restore sp
load r1 r63                                                             ; 0x10a4 -- pop return address
add r63 r63 r62                                                         ; 0x10a5
jmp r1                                                                  ; 0x10a6 -- return
@global::lib::write_end$:                                               ; 0x10a7
@global::lib::input:                                                    ; 0x10a7
@global::lib::input_start$:                                             ; 0x10a7
sub r63 r63 r62                                                         ; 0x10a7 -- push return address
store r63 r0                                                            ; 0x10a8
mov r1 r63                                                              ; 0x10a9 -- frame start
sub r63 r63 r62                                                         ; 0x10aa -- push frame start
store r63 r1                                                            ; 0x10ab
constant r1 @global::lib::read                                          ; 0x10ac -- function address @global::lib::read
constant r2 @global::lib::debug_input_handle                            ; 0x10ae -- global address @global::lib::debug_input_handle
load r2 r2                                                              ; 0x10b0 -- dereference @global::lib::debug_input_handle
load r4 r63                                                             ; 0x10b1 -- stack frame address
constant r3 0x0001                                                      ; 0x10b2 -- argument address buffer
add r3 r4 r3                                                            ; 0x10b4
load r3 r3                                                              ; 0x10b5 -- dereference buffer
sub r63 r63 r62                                                         ; 0x10b6 -- push argument
store r63 r2                                                            ; 0x10b7
sub r63 r63 r62                                                         ; 0x10b8 -- push argument
store r63 r3                                                            ; 0x10b9
constant r0 @global::lib::input_1$                                      ; 0x10ba -- set up return address
jmp r1                                                                  ; 0x10bc
@global::lib::input_1$:                                                 ; 0x10bd -- return address
mov r4 r0                                                               ; 0x10bd
constant r1 0x0002                                                      ; 0x10be -- pop arguments
add r63 r63 r1                                                          ; 0x10c0
mov r0 r4                                                               ; 0x10c1
constant r1 @global::lib::input_return$                                 ; 0x10c2
jmp r1                                                                  ; 0x10c4
@global::lib::input_return$:                                            ; 0x10c5
load r63 r63                                                            ; 0x10c5 -- restore sp
load r1 r63                                                             ; 0x10c6 -- pop return address
add r63 r63 r62                                                         ; 0x10c7
jmp r1                                                                  ; 0x10c8 -- return
@global::lib::input_end$:                                               ; 0x10c9
@global::lib::output:                                                   ; 0x10c9
@global::lib::output_start$:                                            ; 0x10c9
sub r63 r63 r62                                                         ; 0x10c9 -- push return address
store r63 r0                                                            ; 0x10ca
mov r1 r63                                                              ; 0x10cb -- frame start
sub r63 r63 r62                                                         ; 0x10cc -- push frame start
store r63 r1                                                            ; 0x10cd
constant r1 @global::lib::write                                         ; 0x10ce -- function address @global::lib::write
constant r2 @global::lib::debug_output_handle                           ; 0x10d0 -- global address @global::lib::debug_output_handle
load r2 r2                                                              ; 0x10d2 -- dereference @global::lib::debug_output_handle
load r4 r63                                                             ; 0x10d3 -- stack frame address
constant r3 0x0001                                                      ; 0x10d4 -- argument address text
add r3 r4 r3                                                            ; 0x10d6
load r3 r3                                                              ; 0x10d7 -- dereference text
sub r63 r63 r62                                                         ; 0x10d8 -- push argument
store r63 r2                                                            ; 0x10d9
sub r63 r63 r62                                                         ; 0x10da -- push argument
store r63 r3                                                            ; 0x10db
constant r0 @global::lib::output_1$                                     ; 0x10dc -- set up return address
jmp r1                                                                  ; 0x10de
@global::lib::output_1$:                                                ; 0x10df -- return address
mov r4 r0                                                               ; 0x10df
constant r1 0x0002                                                      ; 0x10e0 -- pop arguments
add r63 r63 r1                                                          ; 0x10e2
mov r0 r4                                                               ; 0x10e3
constant r1 @global::lib::output_return$                                ; 0x10e4
jmp r1                                                                  ; 0x10e6
@global::lib::output_return$:                                           ; 0x10e7
load r63 r63                                                            ; 0x10e7 -- restore sp
load r1 r63                                                             ; 0x10e8 -- pop return address
add r63 r63 r62                                                         ; 0x10e9
jmp r1                                                                  ; 0x10ea -- return
@global::lib::output_end$:                                              ; 0x10eb
@global::lib::debugger:                                                 ; 0x10eb
@global::lib::debugger_start$:                                          ; 0x10eb
sub r63 r63 r62                                                         ; 0x10eb -- push return address
store r63 r0                                                            ; 0x10ec
mov r1 r63                                                              ; 0x10ed -- frame start
sub r63 r63 r62                                                         ; 0x10ee -- push frame start
store r63 r1                                                            ; 0x10ef
constant r1 @global::lib::support::syscall                              ; 0x10f0 -- function address @global::lib::support::syscall
constant r2 @global::lib::support::DEBUGGER_SYSCALL                     ; 0x10f2 -- global address @global::lib::support::DEBUGGER_SYSCALL
load r2 r2                                                              ; 0x10f4 -- dereference @global::lib::support::DEBUGGER_SYSCALL
sub r63 r63 r62                                                         ; 0x10f5 -- push argument
store r63 r2                                                            ; 0x10f6
constant r0 @global::lib::debugger_1$                                   ; 0x10f7 -- set up return address
jmp r1                                                                  ; 0x10f9
@global::lib::debugger_1$:                                              ; 0x10fa -- return address
mov r3 r0                                                               ; 0x10fa
constant r1 0x0001                                                      ; 0x10fb -- pop arguments
add r63 r63 r1                                                          ; 0x10fd
@global::lib::debugger_return$:                                         ; 0x10fe
load r63 r63                                                            ; 0x10fe -- restore sp
load r1 r63                                                             ; 0x10ff -- pop return address
add r63 r63 r62                                                         ; 0x1100
jmp r1                                                                  ; 0x1101 -- return
@global::lib::debugger_end$:                                            ; 0x1102
@global::lib::exit:                                                     ; 0x1102
@global::lib::exit_start$:                                              ; 0x1102
sub r63 r63 r62                                                         ; 0x1102 -- push return address
store r63 r0                                                            ; 0x1103
mov r1 r63                                                              ; 0x1104 -- frame start
sub r63 r63 r62                                                         ; 0x1105 -- push frame start
store r63 r1                                                            ; 0x1106
constant r1 @global::lib::support::syscall1                             ; 0x1107 -- function address @global::lib::support::syscall1
constant r2 @global::lib::support::EXIT_SYSCALL                         ; 0x1109 -- global address @global::lib::support::EXIT_SYSCALL
load r2 r2                                                              ; 0x110b -- dereference @global::lib::support::EXIT_SYSCALL
load r4 r63                                                             ; 0x110c -- stack frame address
constant r3 0x0001                                                      ; 0x110d -- argument address code
add r3 r4 r3                                                            ; 0x110f
load r3 r3                                                              ; 0x1110 -- dereference code
sub r63 r63 r62                                                         ; 0x1111 -- push argument
store r63 r2                                                            ; 0x1112
sub r63 r63 r62                                                         ; 0x1113 -- push argument
store r63 r3                                                            ; 0x1114
constant r0 @global::lib::exit_1$                                       ; 0x1115 -- set up return address
jmp r1                                                                  ; 0x1117
@global::lib::exit_1$:                                                  ; 0x1118 -- return address
mov r4 r0                                                               ; 0x1118
constant r1 0x0002                                                      ; 0x1119 -- pop arguments
add r63 r63 r1                                                          ; 0x111b
@global::lib::exit_return$:                                             ; 0x111c
load r63 r63                                                            ; 0x111c -- restore sp
load r1 r63                                                             ; 0x111d -- pop return address
add r63 r63 r62                                                         ; 0x111e
jmp r1                                                                  ; 0x111f -- return
@global::lib::exit_end$:                                                ; 0x1120