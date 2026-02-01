@echo_program_1$:                                                       ; 0x1000
@global::_init:                                                         ; 0x1000
sub r63 r63 r62                                                         ; 0x1000 -- push return address
store r63 r0                                                            ; 0x1001
constant r1 @global::std::fmt::fs                                       ; 0x1002 -- function address @global::std::fmt::fs
constant r2 @global::std::fmt::nl_null_check_end_2$                     ; 0x1004
jnz r1 r2                                                               ; 0x1006
constant r0 0xe0000000                                                  ; 0x1007 -- null error
halt                                                                    ; 0x1009
@global::std::fmt::nl_null_check_end_2$:                                ; 0x100a
constant r4 @global::std::fmt::nl_temporary_1$                          ; 0x100a
constant r2 0x0000                                                      ; 0x100c -- temporary address string_literal_3
add r2 r4 r2                                                            ; 0x100e
mov r3 r2                                                               ; 0x100f -- initialize destination pointer
constant r4 0x000a                                                      ; 0x1010
store r3 r4                                                             ; 0x1012 -- store integral
constant r4 @global::std::fmt::nl_temporary_1$                          ; 0x1013
constant r3 0x0001                                                      ; 0x1015 -- temporary address slice_temp_4
add r3 r4 r3                                                            ; 0x1017
store r3 r2                                                             ; 0x1018 -- slice.pointer
constant r4 0x0001                                                      ; 0x1019 -- array length 1
add r3 r3 r62                                                           ; 0x101b
store r3 r4                                                             ; 0x101c -- slice.length
add r3 r3 r62                                                           ; 0x101d
store r3 r4                                                             ; 0x101e -- slice.capacity
constant r4 @global::std::fmt::nl_temporary_1$                          ; 0x101f
constant r3 0x0001                                                      ; 0x1021 -- temporary address slice_temp_4
add r3 r4 r3                                                            ; 0x1023
constant r4 @global::std::fmt::nl_temporary_1$                          ; 0x1024
constant r2 0x0004                                                      ; 0x1026 -- temporary address return_5
add r2 r4 r2                                                            ; 0x1028
sub r63 r63 r62                                                         ; 0x1029 -- push argument
store r63 r2                                                            ; 0x102a
constant r4 0x0003                                                      ; 0x102b
sub r63 r63 r4                                                          ; 0x102d
mov r4 r63                                                              ; 0x102e
load r5 r3                                                              ; 0x102f -- store argument
store r4 r5                                                             ; 0x1030
add r4 r4 r62                                                           ; 0x1031
add r3 r3 r62                                                           ; 0x1032
load r5 r3                                                              ; 0x1033 -- copy word 1
store r4 r5                                                             ; 0x1034
add r4 r4 r62                                                           ; 0x1035
add r3 r3 r62                                                           ; 0x1036
load r5 r3                                                              ; 0x1037 -- copy word 2
store r4 r5                                                             ; 0x1038
add r4 r4 r62                                                           ; 0x1039
add r3 r3 r62                                                           ; 0x103a
constant r0 @global::std::fmt::nl_6$                                    ; 0x103b -- set up return address
jmp r1                                                                  ; 0x103d
@global::std::fmt::nl_6$:                                               ; 0x103e -- return address
mov r4 r0                                                               ; 0x103e
constant r1 0x0004                                                      ; 0x103f
add r63 r63 r1                                                          ; 0x1041 -- pop arguments
constant r1 @global::std::fmt::nl                                       ; 0x1042 -- reference global global::std::fmt::nl
load r5 r4                                                              ; 0x1044 -- store to global global::std::fmt::nl
store r1 r5                                                             ; 0x1045
add r1 r1 r62                                                           ; 0x1046
add r4 r4 r62                                                           ; 0x1047
load r5 r4                                                              ; 0x1048 -- copy word 1
store r1 r5                                                             ; 0x1049
add r1 r1 r62                                                           ; 0x104a
add r4 r4 r62                                                           ; 0x104b
load r5 r4                                                              ; 0x104c -- copy word 2
store r1 r5                                                             ; 0x104d
add r1 r1 r62                                                           ; 0x104e
add r4 r4 r62                                                           ; 0x104f
load r5 r4                                                              ; 0x1050 -- copy word 3
store r1 r5                                                             ; 0x1051
add r1 r1 r62                                                           ; 0x1052
add r4 r4 r62                                                           ; 0x1053
load r5 r4                                                              ; 0x1054 -- copy word 4
store r1 r5                                                             ; 0x1055
add r1 r1 r62                                                           ; 0x1056
add r4 r4 r62                                                           ; 0x1057
load r5 r4                                                              ; 0x1058 -- copy word 5
store r1 r5                                                             ; 0x1059
add r1 r1 r62                                                           ; 0x105a
add r4 r4 r62                                                           ; 0x105b
load r5 r4                                                              ; 0x105c -- copy word 6
store r1 r5                                                             ; 0x105d
add r1 r1 r62                                                           ; 0x105e
add r4 r4 r62                                                           ; 0x105f
constant r1 0x0001                                                      ; 0x1060
constant r2 0x0000                                                      ; 0x1062 -- -(1)
sub r1 r2 r1                                                            ; 0x1064
constant r2 @global::lib::error::GENERIC_ERROR                          ; 0x1065 -- reference global global::lib::error::GENERIC_ERROR
store r2 r1                                                             ; 0x1067 -- store to global global::lib::error::GENERIC_ERROR
load r1 r63                                                             ; 0x1068 -- pop return address
add r63 r63 r62                                                         ; 0x1069
jmp r1                                                                  ; 0x106a -- return
data @global::std::fmt::nl_temporary_1$ 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ; 0x106b
@global::std::_init_alloc:                                              ; 0x1076
@global::std::_init_alloc_start$:                                       ; 0x1076
sub r63 r63 r62                                                         ; 0x1076 -- push return address
store r63 r0                                                            ; 0x1077
mov r1 r63                                                              ; 0x1078 -- frame start
constant r2 0x0003                                                      ; 0x1079 -- allocate local storage
sub r63 r63 r2                                                          ; 0x107b
sub r63 r63 r62                                                         ; 0x107c -- push frame start
store r63 r1                                                            ; 0x107d
constant r1 @global::std::blocks                                        ; 0x107e -- global address @global::std::blocks
constant r2 @global::std::heap                                          ; 0x1080 -- global address @global::std::heap
load r2 r2                                                              ; 0x1082 -- dereference @global::std::heap
store r1 r2                                                             ; 0x1083 -- blocks = <* block>(heap);
constant r1 @global::std::blocks                                        ; 0x1084 -- global address @global::std::blocks
load r1 r1                                                              ; 0x1086 -- dereference @global::std::blocks
constant r2 @global::std::_init_alloc_null_check_end_1$                 ; 0x1087
jnz r1 r2                                                               ; 0x1089
constant r0 0xe0000000                                                  ; 0x108a -- null error
halt                                                                    ; 0x108c
@global::std::_init_alloc_null_check_end_1$:                            ; 0x108d
load r4 r63                                                             ; 0x108d -- stack frame address
constant r2 0x0003                                                      ; 0x108e -- local address struct_literal_2
sub r2 r4 r2                                                            ; 0x1090
mov r3 r2                                                               ; 0x1091 -- initialize destination pointer
constant r4 0x0000                                                      ; 0x1092
store r3 r4                                                             ; 0x1094 -- store integral
add r3 r3 r62                                                           ; 0x1095 -- next literal expression
constant r4 @global::std::HEAP_SIZE                                     ; 0x1096 -- global address @global::std::HEAP_SIZE
load r4 r4                                                              ; 0x1098 -- dereference @global::std::HEAP_SIZE
constant r5 0x0003                                                      ; 0x1099 -- sizeof block
sub r6 r4 r5                                                            ; 0x109b
store r3 r6                                                             ; 0x109c -- store integral
add r3 r3 r62                                                           ; 0x109d -- next literal expression
constant r4 0x0000                                                      ; 0x109e
store r3 r4                                                             ; 0x10a0 -- store integral
load r3 r2                                                              ; 0x10a1 -- *(blocks) = { allocated = false, size = (HEAP_SIZE) - (sizeof block), next = null };
store r1 r3                                                             ; 0x10a2
add r1 r1 r62                                                           ; 0x10a3
add r2 r2 r62                                                           ; 0x10a4
load r3 r2                                                              ; 0x10a5 -- copy word 1
store r1 r3                                                             ; 0x10a6
add r1 r1 r62                                                           ; 0x10a7
add r2 r2 r62                                                           ; 0x10a8
load r3 r2                                                              ; 0x10a9 -- copy word 2
store r1 r3                                                             ; 0x10aa
add r1 r1 r62                                                           ; 0x10ab
add r2 r2 r62                                                           ; 0x10ac
@global::std::_init_alloc_return$:                                      ; 0x10ad
load r63 r63                                                            ; 0x10ad -- restore sp
load r1 r63                                                             ; 0x10ae -- pop return address
add r63 r63 r62                                                         ; 0x10af
jmp r1                                                                  ; 0x10b0 -- return
@global::std::_init_alloc_end$:                                         ; 0x10b1
@global::std::_merge_blocks:                                            ; 0x10b1
@global::std::_merge_blocks_start$:                                     ; 0x10b1
sub r63 r63 r62                                                         ; 0x10b1 -- push return address
store r63 r0                                                            ; 0x10b2
mov r1 r63                                                              ; 0x10b3 -- frame start
constant r2 0x0002                                                      ; 0x10b4 -- allocate local storage
sub r63 r63 r2                                                          ; 0x10b6
sub r63 r63 r62                                                         ; 0x10b7 -- push frame start
store r63 r1                                                            ; 0x10b8
constant r1 0x0000                                                      ; 0x10b9
load r2 r63                                                             ; 0x10bb -- stack frame address
sub r2 r2 r62                                                           ; 0x10bc -- local address initial_block$2
store r2 r1                                                             ; 0x10bd -- var initial_block: * block = null;
constant r1 @global::std::blocks                                        ; 0x10be -- global address @global::std::blocks
load r1 r1                                                              ; 0x10c0 -- dereference @global::std::blocks
load r3 r63                                                             ; 0x10c1 -- stack frame address
constant r2 0x0002                                                      ; 0x10c2 -- local address b$3
sub r2 r3 r2                                                            ; 0x10c4
store r2 r1                                                             ; 0x10c5 -- var b = blocks
@global::std::_merge_blocks_for_1$:                                     ; 0x10c6
load r3 r63                                                             ; 0x10c6 -- stack frame address
constant r2 0x0002                                                      ; 0x10c7 -- local address b$3
sub r2 r3 r2                                                            ; 0x10c9
load r2 r2                                                              ; 0x10ca -- dereference b$3
constant r3 0x0000                                                      ; 0x10cb -- !(b)
eq r3 r3 r2                                                             ; 0x10cd
constant r2 0x0000                                                      ; 0x10ce -- !(!(b))
eq r2 r2 r3                                                             ; 0x10d0
constant r1 @global::std::_merge_blocks_for_end_3$                      ; 0x10d1
jz r2 r1                                                                ; 0x10d3
load r4 r63                                                             ; 0x10d4 -- stack frame address
constant r3 0x0002                                                      ; 0x10d5 -- local address b$3
sub r3 r4 r3                                                            ; 0x10d7
load r3 r3                                                              ; 0x10d8 -- dereference b$3
constant r4 @global::std::_merge_blocks_null_check_end_4$               ; 0x10d9
jnz r3 r4                                                               ; 0x10db
constant r0 0xe0000000                                                  ; 0x10dc -- null error
halt                                                                    ; 0x10de
@global::std::_merge_blocks_null_check_end_4$:                          ; 0x10df
load r3 r3                                                              ; 0x10df -- deference (b).allocated
constant r4 0x0000                                                      ; 0x10e0 -- !((b).allocated)
eq r4 r4 r3                                                             ; 0x10e2
constant r3 @global::std::_merge_blocks_else_5$                         ; 0x10e3
jz r4 r3                                                                ; 0x10e5
load r5 r63                                                             ; 0x10e6 -- stack frame address
sub r5 r5 r62                                                           ; 0x10e7 -- local address initial_block$2
load r5 r5                                                              ; 0x10e8 -- dereference initial_block$2
constant r6 @global::std::_merge_blocks_else_7$                         ; 0x10e9
jz r5 r6                                                                ; 0x10eb
load r7 r63                                                             ; 0x10ec -- stack frame address
sub r7 r7 r62                                                           ; 0x10ed -- local address initial_block$2
load r7 r7                                                              ; 0x10ee -- dereference initial_block$2
constant r8 @global::std::_merge_blocks_null_check_end_9$               ; 0x10ef
jnz r7 r8                                                               ; 0x10f1
constant r0 0xe0000000                                                  ; 0x10f2 -- null error
halt                                                                    ; 0x10f4
@global::std::_merge_blocks_null_check_end_9$:                          ; 0x10f5
constant r8 0x0002                                                      ; 0x10f5
add r7 r7 r8                                                            ; 0x10f7 -- ->next
load r9 r63                                                             ; 0x10f8 -- stack frame address
constant r8 0x0002                                                      ; 0x10f9 -- local address b$3
sub r8 r9 r8                                                            ; 0x10fb
load r8 r8                                                              ; 0x10fc -- dereference b$3
constant r9 @global::std::_merge_blocks_null_check_end_10$              ; 0x10fd
jnz r8 r9                                                               ; 0x10ff
constant r0 0xe0000000                                                  ; 0x1100 -- null error
halt                                                                    ; 0x1102
@global::std::_merge_blocks_null_check_end_10$:                         ; 0x1103
constant r9 0x0002                                                      ; 0x1103
add r8 r8 r9                                                            ; 0x1105 -- ->next
load r8 r8                                                              ; 0x1106 -- deference (b).next
store r7 r8                                                             ; 0x1107 -- (initial_block).next = (b).next;
load r7 r63                                                             ; 0x1108 -- stack frame address
sub r7 r7 r62                                                           ; 0x1109 -- local address initial_block$2
load r7 r7                                                              ; 0x110a -- dereference initial_block$2
constant r8 @global::std::_merge_blocks_null_check_end_11$              ; 0x110b
jnz r7 r8                                                               ; 0x110d
constant r0 0xe0000000                                                  ; 0x110e -- null error
halt                                                                    ; 0x1110
@global::std::_merge_blocks_null_check_end_11$:                         ; 0x1111
add r7 r7 r62                                                           ; 0x1111 -- ->size
load r8 r63                                                             ; 0x1112 -- stack frame address
sub r8 r8 r62                                                           ; 0x1113 -- local address initial_block$2
load r8 r8                                                              ; 0x1114 -- dereference initial_block$2
constant r9 @global::std::_merge_blocks_null_check_end_12$              ; 0x1115
jnz r8 r9                                                               ; 0x1117
constant r0 0xe0000000                                                  ; 0x1118 -- null error
halt                                                                    ; 0x111a
@global::std::_merge_blocks_null_check_end_12$:                         ; 0x111b
add r8 r8 r62                                                           ; 0x111b -- ->size
load r8 r8                                                              ; 0x111c -- deference (initial_block).size
constant r9 0x0003                                                      ; 0x111d -- sizeof block
add r10 r8 r9                                                           ; 0x111f
load r9 r63                                                             ; 0x1120 -- stack frame address
constant r8 0x0002                                                      ; 0x1121 -- local address b$3
sub r8 r9 r8                                                            ; 0x1123
load r8 r8                                                              ; 0x1124 -- dereference b$3
constant r9 @global::std::_merge_blocks_null_check_end_13$              ; 0x1125
jnz r8 r9                                                               ; 0x1127
constant r0 0xe0000000                                                  ; 0x1128 -- null error
halt                                                                    ; 0x112a
@global::std::_merge_blocks_null_check_end_13$:                         ; 0x112b
add r8 r8 r62                                                           ; 0x112b -- ->size
load r8 r8                                                              ; 0x112c -- deference (b).size
add r9 r10 r8                                                           ; 0x112d
store r7 r9                                                             ; 0x112e -- (initial_block).size = (((initial_block).size) + (sizeof block)) + ((b).size);
constant r6 @global::std::_merge_blocks_if_end_8$                       ; 0x112f
jmp r6                                                                  ; 0x1131
@global::std::_merge_blocks_else_7$:                                    ; 0x1132
load r7 r63                                                             ; 0x1132 -- stack frame address
sub r7 r7 r62                                                           ; 0x1133 -- local address initial_block$2
load r9 r63                                                             ; 0x1134 -- stack frame address
constant r8 0x0002                                                      ; 0x1135 -- local address b$3
sub r8 r9 r8                                                            ; 0x1137
load r8 r8                                                              ; 0x1138 -- dereference b$3
store r7 r8                                                             ; 0x1139 -- initial_block = b;
@global::std::_merge_blocks_if_end_8$:                                  ; 0x113a
constant r3 @global::std::_merge_blocks_if_end_6$                       ; 0x113a
jmp r3                                                                  ; 0x113c
@global::std::_merge_blocks_else_5$:                                    ; 0x113d
load r5 r63                                                             ; 0x113d -- stack frame address
sub r5 r5 r62                                                           ; 0x113e -- local address initial_block$2
constant r6 0x0000                                                      ; 0x113f
store r5 r6                                                             ; 0x1141 -- initial_block = null;
@global::std::_merge_blocks_if_end_6$:                                  ; 0x1142
@global::std::_merge_blocks_for_continue_2$:                            ; 0x1142
load r4 r63                                                             ; 0x1142 -- stack frame address
constant r3 0x0002                                                      ; 0x1143 -- local address b$3
sub r3 r4 r3                                                            ; 0x1145
load r5 r63                                                             ; 0x1146 -- stack frame address
constant r4 0x0002                                                      ; 0x1147 -- local address b$3
sub r4 r5 r4                                                            ; 0x1149
load r4 r4                                                              ; 0x114a -- dereference b$3
constant r5 @global::std::_merge_blocks_null_check_end_14$              ; 0x114b
jnz r4 r5                                                               ; 0x114d
constant r0 0xe0000000                                                  ; 0x114e -- null error
halt                                                                    ; 0x1150
@global::std::_merge_blocks_null_check_end_14$:                         ; 0x1151
constant r5 0x0002                                                      ; 0x1151
add r4 r4 r5                                                            ; 0x1153 -- ->next
load r4 r4                                                              ; 0x1154 -- deference (b).next
store r3 r4                                                             ; 0x1155 -- b = (b).next;
constant r1 @global::std::_merge_blocks_for_1$                          ; 0x1156
jmp r1                                                                  ; 0x1158
@global::std::_merge_blocks_for_end_3$:                                 ; 0x1159
@global::std::_merge_blocks_return$:                                    ; 0x1159
load r63 r63                                                            ; 0x1159 -- restore sp
load r1 r63                                                             ; 0x115a -- pop return address
add r63 r63 r62                                                         ; 0x115b
jmp r1                                                                  ; 0x115c -- return
@global::std::_merge_blocks_end$:                                       ; 0x115d
@global::std::alloc:                                                    ; 0x115d
@global::std::alloc_start$:                                             ; 0x115d
sub r63 r63 r62                                                         ; 0x115d -- push return address
store r63 r0                                                            ; 0x115e
mov r1 r63                                                              ; 0x115f -- frame start
constant r2 0x0004                                                      ; 0x1160 -- allocate local storage
sub r63 r63 r2                                                          ; 0x1162
sub r63 r63 r62                                                         ; 0x1163 -- push frame start
store r63 r1                                                            ; 0x1164
constant r1 @global::std::blocks                                        ; 0x1165 -- global address @global::std::blocks
load r1 r1                                                              ; 0x1167 -- dereference @global::std::blocks
constant r2 0x0000                                                      ; 0x1168 -- !(blocks)
eq r2 r2 r1                                                             ; 0x116a
constant r1 @global::std::alloc_else_1$                                 ; 0x116b
jz r2 r1                                                                ; 0x116d
constant r3 @global::std::_init_alloc                                   ; 0x116e -- function address @global::std::_init_alloc
constant r4 @global::std::alloc_null_check_end_3$                       ; 0x1170
jnz r3 r4                                                               ; 0x1172
constant r0 0xe0000000                                                  ; 0x1173 -- null error
halt                                                                    ; 0x1175
@global::std::alloc_null_check_end_3$:                                  ; 0x1176
load r4 r63                                                             ; 0x1176 -- save frame pointer for call
sub r63 r63 r62                                                         ; 0x1177 -- push caller-save register
store r63 r1                                                            ; 0x1178
sub r63 r63 r62                                                         ; 0x1179 -- push caller-save register
store r63 r2                                                            ; 0x117a
constant r0 @global::std::alloc_4$                                      ; 0x117b -- set up return address
jmp r3                                                                  ; 0x117d -- call
@global::std::alloc_4$:                                                 ; 0x117e -- return address
mov r4 r0                                                               ; 0x117e
load r2 r63                                                             ; 0x117f -- pop caller-save register
add r63 r63 r62                                                         ; 0x1180
load r1 r63                                                             ; 0x1181 -- pop caller-save register
add r63 r63 r62                                                         ; 0x1182
constant r1 @global::std::alloc_if_end_2$                               ; 0x1183
jmp r1                                                                  ; 0x1185
@global::std::alloc_else_1$:                                            ; 0x1186
@global::std::alloc_if_end_2$:                                          ; 0x1186
constant r1 0x0000                                                      ; 0x1186
load r2 r63                                                             ; 0x1188 -- stack frame address
sub r2 r2 r62                                                           ; 0x1189 -- local address free_block$2
store r2 r1                                                             ; 0x118a -- var free_block: * block = null;
constant r1 @global::std::blocks                                        ; 0x118b -- global address @global::std::blocks
load r1 r1                                                              ; 0x118d -- dereference @global::std::blocks
load r3 r63                                                             ; 0x118e -- stack frame address
constant r2 0x0002                                                      ; 0x118f -- local address b$3
sub r2 r3 r2                                                            ; 0x1191
store r2 r1                                                             ; 0x1192 -- var b = blocks
@global::std::alloc_for_5$:                                             ; 0x1193
load r3 r63                                                             ; 0x1193 -- stack frame address
constant r2 0x0002                                                      ; 0x1194 -- local address b$3
sub r2 r3 r2                                                            ; 0x1196
load r2 r2                                                              ; 0x1197 -- dereference b$3
constant r3 0x0000                                                      ; 0x1198 -- !(b)
eq r3 r3 r2                                                             ; 0x119a
constant r2 0x0000                                                      ; 0x119b -- !(!(b))
eq r2 r2 r3                                                             ; 0x119d
constant r1 @global::std::alloc_for_end_7$                              ; 0x119e
jz r2 r1                                                                ; 0x11a0
load r4 r63                                                             ; 0x11a1 -- stack frame address
constant r3 0x0002                                                      ; 0x11a2 -- local address b$3
sub r3 r4 r3                                                            ; 0x11a4
load r3 r3                                                              ; 0x11a5 -- dereference b$3
constant r4 @global::std::alloc_null_check_end_8$                       ; 0x11a6
jnz r3 r4                                                               ; 0x11a8
constant r0 0xe0000000                                                  ; 0x11a9 -- null error
halt                                                                    ; 0x11ab
@global::std::alloc_null_check_end_8$:                                  ; 0x11ac
load r3 r3                                                              ; 0x11ac -- deference (b).allocated
constant r4 0x0000                                                      ; 0x11ad -- !((b).allocated)
eq r4 r4 r3                                                             ; 0x11af
constant r3 @global::std::alloc_and_end_9$                              ; 0x11b0
jz r4 r3                                                                ; 0x11b2
load r6 r63                                                             ; 0x11b3 -- stack frame address
constant r5 0x0002                                                      ; 0x11b4 -- local address b$3
sub r5 r6 r5                                                            ; 0x11b6
load r5 r5                                                              ; 0x11b7 -- dereference b$3
constant r6 @global::std::alloc_null_check_end_10$                      ; 0x11b8
jnz r5 r6                                                               ; 0x11ba
constant r0 0xe0000000                                                  ; 0x11bb -- null error
halt                                                                    ; 0x11bd
@global::std::alloc_null_check_end_10$:                                 ; 0x11be
add r5 r5 r62                                                           ; 0x11be -- ->size
load r5 r5                                                              ; 0x11bf -- deference (b).size
load r7 r63                                                             ; 0x11c0 -- stack frame address
constant r6 0x0001                                                      ; 0x11c1 -- argument address size$1
add r6 r7 r6                                                            ; 0x11c3
load r6 r6                                                              ; 0x11c4 -- dereference size$1
lt r7 r5 r6                                                             ; 0x11c5
constant r8 0x0000                                                      ; 0x11c6
eq r7 r7 r8                                                             ; 0x11c8
mov r4 r7                                                               ; 0x11c9
@global::std::alloc_and_end_9$:                                         ; 0x11ca -- end &&
constant r5 @global::std::alloc_else_11$                                ; 0x11ca
jz r4 r5                                                                ; 0x11cc
load r6 r63                                                             ; 0x11cd -- stack frame address
sub r6 r6 r62                                                           ; 0x11ce -- local address free_block$2
load r8 r63                                                             ; 0x11cf -- stack frame address
constant r7 0x0002                                                      ; 0x11d0 -- local address b$3
sub r7 r8 r7                                                            ; 0x11d2
load r7 r7                                                              ; 0x11d3 -- dereference b$3
store r6 r7                                                             ; 0x11d4 -- free_block = b;
constant r6 @global::std::alloc_for_end_7$                              ; 0x11d5
jmp r6                                                                  ; 0x11d7
constant r5 @global::std::alloc_if_end_12$                              ; 0x11d8
jmp r5                                                                  ; 0x11da
@global::std::alloc_else_11$:                                           ; 0x11db
@global::std::alloc_if_end_12$:                                         ; 0x11db
@global::std::alloc_for_continue_6$:                                    ; 0x11db
load r5 r63                                                             ; 0x11db -- stack frame address
constant r4 0x0002                                                      ; 0x11dc -- local address b$3
sub r4 r5 r4                                                            ; 0x11de
load r6 r63                                                             ; 0x11df -- stack frame address
constant r5 0x0002                                                      ; 0x11e0 -- local address b$3
sub r5 r6 r5                                                            ; 0x11e2
load r5 r5                                                              ; 0x11e3 -- dereference b$3
constant r6 @global::std::alloc_null_check_end_13$                      ; 0x11e4
jnz r5 r6                                                               ; 0x11e6
constant r0 0xe0000000                                                  ; 0x11e7 -- null error
halt                                                                    ; 0x11e9
@global::std::alloc_null_check_end_13$:                                 ; 0x11ea
constant r6 0x0002                                                      ; 0x11ea
add r5 r5 r6                                                            ; 0x11ec -- ->next
load r5 r5                                                              ; 0x11ed -- deference (b).next
store r4 r5                                                             ; 0x11ee -- b = (b).next;
constant r1 @global::std::alloc_for_5$                                  ; 0x11ef
jmp r1                                                                  ; 0x11f1
@global::std::alloc_for_end_7$:                                         ; 0x11f2
load r1 r63                                                             ; 0x11f2 -- stack frame address
sub r1 r1 r62                                                           ; 0x11f3 -- local address free_block$2
load r1 r1                                                              ; 0x11f4 -- dereference free_block$2
constant r2 0x0000                                                      ; 0x11f5 -- !(free_block)
eq r2 r2 r1                                                             ; 0x11f7
constant r1 @global::std::alloc_else_14$                                ; 0x11f8
jz r2 r1                                                                ; 0x11fa
constant r4 0x0000                                                      ; 0x11fb
mov r0 r4                                                               ; 0x11fd
constant r5 @global::std::alloc_return$                                 ; 0x11fe
jmp r5                                                                  ; 0x1200
constant r1 @global::std::alloc_if_end_15$                              ; 0x1201
jmp r1                                                                  ; 0x1203
@global::std::alloc_else_14$:                                           ; 0x1204
@global::std::alloc_if_end_15$:                                         ; 0x1204
load r1 r63                                                             ; 0x1204 -- stack frame address
sub r1 r1 r62                                                           ; 0x1205 -- local address free_block$2
load r1 r1                                                              ; 0x1206 -- dereference free_block$2
constant r2 @global::std::alloc_null_check_end_16$                      ; 0x1207
jnz r1 r2                                                               ; 0x1209
constant r0 0xe0000000                                                  ; 0x120a -- null error
halt                                                                    ; 0x120c
@global::std::alloc_null_check_end_16$:                                 ; 0x120d
constant r2 0x0001                                                      ; 0x120d
store r1 r2                                                             ; 0x120f -- (free_block).allocated = true;
load r1 r63                                                             ; 0x1210 -- stack frame address
sub r1 r1 r62                                                           ; 0x1211 -- local address free_block$2
load r1 r1                                                              ; 0x1212 -- dereference free_block$2
constant r2 0x0003                                                      ; 0x1213 -- sizeof block
add r4 r1 r2                                                            ; 0x1215
load r2 r63                                                             ; 0x1216 -- stack frame address
constant r1 0x0003                                                      ; 0x1217 -- local address ptr$2
sub r1 r2 r1                                                            ; 0x1219
store r1 r4                                                             ; 0x121a -- var ptr = <* byte>((<byte>(free_block)) + (sizeof block))
load r1 r63                                                             ; 0x121b -- stack frame address
sub r1 r1 r62                                                           ; 0x121c -- local address free_block$2
load r1 r1                                                              ; 0x121d -- dereference free_block$2
constant r2 @global::std::alloc_null_check_end_17$                      ; 0x121e
jnz r1 r2                                                               ; 0x1220
constant r0 0xe0000000                                                  ; 0x1221 -- null error
halt                                                                    ; 0x1223
@global::std::alloc_null_check_end_17$:                                 ; 0x1224
add r1 r1 r62                                                           ; 0x1224 -- ->size
load r1 r1                                                              ; 0x1225 -- deference (free_block).size
load r4 r63                                                             ; 0x1226 -- stack frame address
constant r2 0x0001                                                      ; 0x1227 -- argument address size$1
add r2 r4 r2                                                            ; 0x1229
load r2 r2                                                              ; 0x122a -- dereference size$1
sub r4 r1 r2                                                            ; 0x122b
constant r1 0x0003                                                      ; 0x122c -- sizeof block
constant r2 @global::std::SPLIT_THRESHOLD                               ; 0x122e -- global address @global::std::SPLIT_THRESHOLD
load r2 r2                                                              ; 0x1230 -- dereference @global::std::SPLIT_THRESHOLD
add r5 r1 r2                                                            ; 0x1231
gt r1 r4 r5                                                             ; 0x1232
constant r2 @global::std::alloc_else_18$                                ; 0x1233
jz r1 r2                                                                ; 0x1235
load r5 r63                                                             ; 0x1236 -- stack frame address
constant r4 0x0003                                                      ; 0x1237 -- local address ptr$2
sub r4 r5 r4                                                            ; 0x1239
load r4 r4                                                              ; 0x123a -- dereference ptr$2
load r6 r63                                                             ; 0x123b -- stack frame address
constant r5 0x0001                                                      ; 0x123c -- argument address size$1
add r5 r6 r5                                                            ; 0x123e
load r5 r5                                                              ; 0x123f -- dereference size$1
add r6 r4 r5                                                            ; 0x1240
load r5 r63                                                             ; 0x1241 -- stack frame address
constant r4 0x0004                                                      ; 0x1242 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1244
store r4 r6                                                             ; 0x1245 -- var split_block = <* block>((<byte>(ptr)) + (size))
load r5 r63                                                             ; 0x1246 -- stack frame address
constant r4 0x0004                                                      ; 0x1247 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1249
load r4 r4                                                              ; 0x124a -- dereference split_block$3
constant r5 @global::std::alloc_null_check_end_20$                      ; 0x124b
jnz r4 r5                                                               ; 0x124d
constant r0 0xe0000000                                                  ; 0x124e -- null error
halt                                                                    ; 0x1250
@global::std::alloc_null_check_end_20$:                                 ; 0x1251
constant r5 0x0000                                                      ; 0x1251
store r4 r5                                                             ; 0x1253 -- (split_block).allocated = false;
load r5 r63                                                             ; 0x1254 -- stack frame address
constant r4 0x0004                                                      ; 0x1255 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1257
load r4 r4                                                              ; 0x1258 -- dereference split_block$3
constant r5 @global::std::alloc_null_check_end_21$                      ; 0x1259
jnz r4 r5                                                               ; 0x125b
constant r0 0xe0000000                                                  ; 0x125c -- null error
halt                                                                    ; 0x125e
@global::std::alloc_null_check_end_21$:                                 ; 0x125f
add r4 r4 r62                                                           ; 0x125f -- ->size
load r5 r63                                                             ; 0x1260 -- stack frame address
sub r5 r5 r62                                                           ; 0x1261 -- local address free_block$2
load r5 r5                                                              ; 0x1262 -- dereference free_block$2
constant r6 @global::std::alloc_null_check_end_22$                      ; 0x1263
jnz r5 r6                                                               ; 0x1265
constant r0 0xe0000000                                                  ; 0x1266 -- null error
halt                                                                    ; 0x1268
@global::std::alloc_null_check_end_22$:                                 ; 0x1269
add r5 r5 r62                                                           ; 0x1269 -- ->size
load r5 r5                                                              ; 0x126a -- deference (free_block).size
load r7 r63                                                             ; 0x126b -- stack frame address
constant r6 0x0001                                                      ; 0x126c -- argument address size$1
add r6 r7 r6                                                            ; 0x126e
load r6 r6                                                              ; 0x126f -- dereference size$1
sub r7 r5 r6                                                            ; 0x1270
constant r5 0x0003                                                      ; 0x1271 -- sizeof block
sub r6 r7 r5                                                            ; 0x1273
store r4 r6                                                             ; 0x1274 -- (split_block).size = (((free_block).size) - (size)) - (sizeof block);
load r5 r63                                                             ; 0x1275 -- stack frame address
constant r4 0x0004                                                      ; 0x1276 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1278
load r4 r4                                                              ; 0x1279 -- dereference split_block$3
constant r5 @global::std::alloc_null_check_end_23$                      ; 0x127a
jnz r4 r5                                                               ; 0x127c
constant r0 0xe0000000                                                  ; 0x127d -- null error
halt                                                                    ; 0x127f
@global::std::alloc_null_check_end_23$:                                 ; 0x1280
constant r5 0x0002                                                      ; 0x1280
add r4 r4 r5                                                            ; 0x1282 -- ->next
load r5 r63                                                             ; 0x1283 -- stack frame address
sub r5 r5 r62                                                           ; 0x1284 -- local address free_block$2
load r5 r5                                                              ; 0x1285 -- dereference free_block$2
constant r6 @global::std::alloc_null_check_end_24$                      ; 0x1286
jnz r5 r6                                                               ; 0x1288
constant r0 0xe0000000                                                  ; 0x1289 -- null error
halt                                                                    ; 0x128b
@global::std::alloc_null_check_end_24$:                                 ; 0x128c
constant r6 0x0002                                                      ; 0x128c
add r5 r5 r6                                                            ; 0x128e -- ->next
load r5 r5                                                              ; 0x128f -- deference (free_block).next
store r4 r5                                                             ; 0x1290 -- (split_block).next = (free_block).next;
load r4 r63                                                             ; 0x1291 -- stack frame address
sub r4 r4 r62                                                           ; 0x1292 -- local address free_block$2
load r4 r4                                                              ; 0x1293 -- dereference free_block$2
constant r5 @global::std::alloc_null_check_end_25$                      ; 0x1294
jnz r4 r5                                                               ; 0x1296
constant r0 0xe0000000                                                  ; 0x1297 -- null error
halt                                                                    ; 0x1299
@global::std::alloc_null_check_end_25$:                                 ; 0x129a
add r4 r4 r62                                                           ; 0x129a -- ->size
load r6 r63                                                             ; 0x129b -- stack frame address
constant r5 0x0001                                                      ; 0x129c -- argument address size$1
add r5 r6 r5                                                            ; 0x129e
load r5 r5                                                              ; 0x129f -- dereference size$1
store r4 r5                                                             ; 0x12a0 -- (free_block).size = size;
load r4 r63                                                             ; 0x12a1 -- stack frame address
sub r4 r4 r62                                                           ; 0x12a2 -- local address free_block$2
load r4 r4                                                              ; 0x12a3 -- dereference free_block$2
constant r5 @global::std::alloc_null_check_end_26$                      ; 0x12a4
jnz r4 r5                                                               ; 0x12a6
constant r0 0xe0000000                                                  ; 0x12a7 -- null error
halt                                                                    ; 0x12a9
@global::std::alloc_null_check_end_26$:                                 ; 0x12aa
constant r5 0x0002                                                      ; 0x12aa
add r4 r4 r5                                                            ; 0x12ac -- ->next
load r6 r63                                                             ; 0x12ad -- stack frame address
constant r5 0x0004                                                      ; 0x12ae -- local address split_block$3
sub r5 r6 r5                                                            ; 0x12b0
load r5 r5                                                              ; 0x12b1 -- dereference split_block$3
store r4 r5                                                             ; 0x12b2 -- (free_block).next = split_block;
constant r2 @global::std::alloc_if_end_19$                              ; 0x12b3
jmp r2                                                                  ; 0x12b5
@global::std::alloc_else_18$:                                           ; 0x12b6
@global::std::alloc_if_end_19$:                                         ; 0x12b6
load r2 r63                                                             ; 0x12b6 -- stack frame address
constant r1 0x0003                                                      ; 0x12b7 -- local address ptr$2
sub r1 r2 r1                                                            ; 0x12b9
load r1 r1                                                              ; 0x12ba -- dereference ptr$2
mov r0 r1                                                               ; 0x12bb
constant r2 @global::std::alloc_return$                                 ; 0x12bc
jmp r2                                                                  ; 0x12be
@global::std::alloc_return$:                                            ; 0x12bf
load r63 r63                                                            ; 0x12bf -- restore sp
load r1 r63                                                             ; 0x12c0 -- pop return address
add r63 r63 r62                                                         ; 0x12c1
jmp r1                                                                  ; 0x12c2 -- return
@global::std::alloc_end$:                                               ; 0x12c3
@global::std::dealloc:                                                  ; 0x12c3
@global::std::dealloc_start$:                                           ; 0x12c3
sub r63 r63 r62                                                         ; 0x12c3 -- push return address
store r63 r0                                                            ; 0x12c4
mov r1 r63                                                              ; 0x12c5 -- frame start
sub r63 r63 r62                                                         ; 0x12c6 -- allocate local storage
sub r63 r63 r62                                                         ; 0x12c7 -- push frame start
store r63 r1                                                            ; 0x12c8
load r2 r63                                                             ; 0x12c9 -- stack frame address
constant r1 0x0001                                                      ; 0x12ca -- argument address pointer$1
add r1 r2 r1                                                            ; 0x12cc
load r1 r1                                                              ; 0x12cd -- dereference pointer$1
constant r2 0x0000                                                      ; 0x12ce -- !(pointer)
eq r2 r2 r1                                                             ; 0x12d0
constant r1 @global::std::dealloc_else_1$                               ; 0x12d1
jz r2 r1                                                                ; 0x12d3
constant r3 0x0000                                                      ; 0x12d4
mov r0 r3                                                               ; 0x12d6
constant r4 @global::std::dealloc_return$                               ; 0x12d7
jmp r4                                                                  ; 0x12d9
constant r1 @global::std::dealloc_if_end_2$                             ; 0x12da
jmp r1                                                                  ; 0x12dc
@global::std::dealloc_else_1$:                                          ; 0x12dd
@global::std::dealloc_if_end_2$:                                        ; 0x12dd
load r2 r63                                                             ; 0x12dd -- stack frame address
constant r1 0x0001                                                      ; 0x12de -- argument address pointer$1
add r1 r2 r1                                                            ; 0x12e0
load r1 r1                                                              ; 0x12e1 -- dereference pointer$1
constant r2 0x0003                                                      ; 0x12e2 -- sizeof block
sub r3 r1 r2                                                            ; 0x12e4
load r1 r63                                                             ; 0x12e5 -- stack frame address
sub r1 r1 r62                                                           ; 0x12e6 -- local address b$2
store r1 r3                                                             ; 0x12e7 -- var b = <* block>((<byte>(pointer)) - (sizeof block))
load r1 r63                                                             ; 0x12e8 -- stack frame address
sub r1 r1 r62                                                           ; 0x12e9 -- local address b$2
load r1 r1                                                              ; 0x12ea -- dereference b$2
constant r2 @global::std::dealloc_null_check_end_3$                     ; 0x12eb
jnz r1 r2                                                               ; 0x12ed
constant r0 0xe0000000                                                  ; 0x12ee -- null error
halt                                                                    ; 0x12f0
@global::std::dealloc_null_check_end_3$:                                ; 0x12f1
constant r2 0x0000                                                      ; 0x12f1
store r1 r2                                                             ; 0x12f3 -- (b).allocated = false;
constant r1 @global::std::_merge_blocks                                 ; 0x12f4 -- function address @global::std::_merge_blocks
constant r2 @global::std::dealloc_null_check_end_4$                     ; 0x12f6
jnz r1 r2                                                               ; 0x12f8
constant r0 0xe0000000                                                  ; 0x12f9 -- null error
halt                                                                    ; 0x12fb
@global::std::dealloc_null_check_end_4$:                                ; 0x12fc
load r2 r63                                                             ; 0x12fc -- save frame pointer for call
constant r0 @global::std::dealloc_5$                                    ; 0x12fd -- set up return address
jmp r1                                                                  ; 0x12ff -- call
@global::std::dealloc_5$:                                               ; 0x1300 -- return address
mov r2 r0                                                               ; 0x1300
@global::std::dealloc_return$:                                          ; 0x1301
load r63 r63                                                            ; 0x1301 -- restore sp
load r1 r63                                                             ; 0x1302 -- pop return address
add r63 r63 r62                                                         ; 0x1303
jmp r1                                                                  ; 0x1304 -- return
@global::std::dealloc_end$:                                             ; 0x1305
@global::std::fmt::fs:                                                  ; 0x1305
@global::std::fmt::fs_start$:                                           ; 0x1305
sub r63 r63 r62                                                         ; 0x1305 -- push return address
store r63 r0                                                            ; 0x1306
mov r1 r63                                                              ; 0x1307 -- frame start
constant r2 0x0007                                                      ; 0x1308 -- allocate local storage
sub r63 r63 r2                                                          ; 0x130a
sub r63 r63 r62                                                         ; 0x130b -- push frame start
store r63 r1                                                            ; 0x130c
load r3 r63                                                             ; 0x130d -- stack frame address
constant r1 0x0007                                                      ; 0x130e -- local address struct_literal_1
sub r1 r3 r1                                                            ; 0x1310
mov r2 r1                                                               ; 0x1311 -- initialize destination pointer
constant r3 @`global::std::fmt::fmt_type::S`                            ; 0x1312 -- global address @`global::std::fmt::fmt_type::S`
load r3 r3                                                              ; 0x1314 -- dereference @`global::std::fmt::fmt_type::S`
store r2 r3                                                             ; 0x1315 -- store integral
add r2 r2 r62                                                           ; 0x1316 -- next literal expression
constant r3 0x0000                                                      ; 0x1317
store r2 r3                                                             ; 0x1319
add r2 r2 r62                                                           ; 0x131a -- next literal expression
constant r3 0x0000                                                      ; 0x131b
store r2 r3                                                             ; 0x131d
add r2 r2 r62                                                           ; 0x131e -- next literal expression
load r4 r63                                                             ; 0x131f -- stack frame address
constant r3 0x0001                                                      ; 0x1320 -- argument address s$1
add r3 r4 r3                                                            ; 0x1322
load r4 r3                                                              ; 0x1323 -- copy non-integral
store r2 r4                                                             ; 0x1324
add r2 r2 r62                                                           ; 0x1325
add r3 r3 r62                                                           ; 0x1326
load r4 r3                                                              ; 0x1327 -- copy word 1
store r2 r4                                                             ; 0x1328
add r2 r2 r62                                                           ; 0x1329
add r3 r3 r62                                                           ; 0x132a
load r4 r3                                                              ; 0x132b -- copy word 2
store r2 r4                                                             ; 0x132c
add r2 r2 r62                                                           ; 0x132d
add r3 r3 r62                                                           ; 0x132e
constant r3 0x0000                                                      ; 0x132f
store r2 r3                                                             ; 0x1331
load r3 r63                                                             ; 0x1332 -- stack frame address
constant r2 0x0004                                                      ; 0x1333 -- argument address $return
add r2 r3 r2                                                            ; 0x1335
load r2 r2                                                              ; 0x1336 -- dereference $return
mov r3 r2                                                               ; 0x1337 -- save return destination
load r4 r1                                                              ; 0x1338 -- copy return data
store r2 r4                                                             ; 0x1339
add r2 r2 r62                                                           ; 0x133a
add r1 r1 r62                                                           ; 0x133b
load r4 r1                                                              ; 0x133c -- copy word 1
store r2 r4                                                             ; 0x133d
add r2 r2 r62                                                           ; 0x133e
add r1 r1 r62                                                           ; 0x133f
load r4 r1                                                              ; 0x1340 -- copy word 2
store r2 r4                                                             ; 0x1341
add r2 r2 r62                                                           ; 0x1342
add r1 r1 r62                                                           ; 0x1343
load r4 r1                                                              ; 0x1344 -- copy word 3
store r2 r4                                                             ; 0x1345
add r2 r2 r62                                                           ; 0x1346
add r1 r1 r62                                                           ; 0x1347
load r4 r1                                                              ; 0x1348 -- copy word 4
store r2 r4                                                             ; 0x1349
add r2 r2 r62                                                           ; 0x134a
add r1 r1 r62                                                           ; 0x134b
load r4 r1                                                              ; 0x134c -- copy word 5
store r2 r4                                                             ; 0x134d
add r2 r2 r62                                                           ; 0x134e
add r1 r1 r62                                                           ; 0x134f
load r4 r1                                                              ; 0x1350 -- copy word 6
store r2 r4                                                             ; 0x1351
add r2 r2 r62                                                           ; 0x1352
add r1 r1 r62                                                           ; 0x1353
mov r1 r3                                                               ; 0x1354
mov r0 r1                                                               ; 0x1355
constant r2 @global::std::fmt::fs_return$                               ; 0x1356
jmp r2                                                                  ; 0x1358
@global::std::fmt::fs_return$:                                          ; 0x1359
load r63 r63                                                            ; 0x1359 -- restore sp
load r1 r63                                                             ; 0x135a -- pop return address
add r63 r63 r62                                                         ; 0x135b
jmp r1                                                                  ; 0x135c -- return
@global::std::fmt::fs_end$:                                             ; 0x135d
@global::system::_ensure_heap:                                          ; 0x135d
@global::system::_ensure_heap_start$:                                   ; 0x135d
sub r63 r63 r62                                                         ; 0x135d -- push return address
store r63 r0                                                            ; 0x135e
mov r1 r63                                                              ; 0x135f -- frame start
sub r63 r63 r62                                                         ; 0x1360 -- push frame start
store r63 r1                                                            ; 0x1361
constant r1 @global::std::heap                                          ; 0x1362 -- global address @global::std::heap
load r1 r1                                                              ; 0x1364 -- dereference @global::std::heap
constant r2 0x0000                                                      ; 0x1365 -- !(std::heap)
eq r2 r2 r1                                                             ; 0x1367
constant r1 @global::system::_ensure_heap_else_1$                       ; 0x1368
jz r2 r1                                                                ; 0x136a
constant r3 @global::std::heap                                          ; 0x136b -- global address @global::std::heap
constant r4 0x4000                                                      ; 0x136d
store r3 r4                                                             ; 0x136f -- std::heap = <* byte>(16384);
constant r1 @global::system::_ensure_heap_if_end_2$                     ; 0x1370
jmp r1                                                                  ; 0x1372
@global::system::_ensure_heap_else_1$:                                  ; 0x1373
@global::system::_ensure_heap_if_end_2$:                                ; 0x1373
@global::system::_ensure_heap_return$:                                  ; 0x1373
load r63 r63                                                            ; 0x1373 -- restore sp
load r1 r63                                                             ; 0x1374 -- pop return address
add r63 r63 r62                                                         ; 0x1375
jmp r1                                                                  ; 0x1376 -- return
@global::system::_ensure_heap_end$:                                     ; 0x1377
@global::system::alloc:                                                 ; 0x1377
@global::system::alloc_start$:                                          ; 0x1377
sub r63 r63 r62                                                         ; 0x1377 -- push return address
store r63 r0                                                            ; 0x1378
mov r1 r63                                                              ; 0x1379 -- frame start
sub r63 r63 r62                                                         ; 0x137a -- push frame start
store r63 r1                                                            ; 0x137b
constant r1 @global::system::_ensure_heap                               ; 0x137c -- function address @global::system::_ensure_heap
constant r2 @global::system::alloc_null_check_end_1$                    ; 0x137e
jnz r1 r2                                                               ; 0x1380
constant r0 0xe0000000                                                  ; 0x1381 -- null error
halt                                                                    ; 0x1383
@global::system::alloc_null_check_end_1$:                               ; 0x1384
load r2 r63                                                             ; 0x1384 -- save frame pointer for call
constant r0 @global::system::alloc_2$                                   ; 0x1385 -- set up return address
jmp r1                                                                  ; 0x1387 -- call
@global::system::alloc_2$:                                              ; 0x1388 -- return address
mov r2 r0                                                               ; 0x1388
constant r1 @global::std::alloc                                         ; 0x1389 -- function address @global::std::alloc
constant r2 @global::system::alloc_null_check_end_3$                    ; 0x138b
jnz r1 r2                                                               ; 0x138d
constant r0 0xe0000000                                                  ; 0x138e -- null error
halt                                                                    ; 0x1390
@global::system::alloc_null_check_end_3$:                               ; 0x1391
load r2 r63                                                             ; 0x1391 -- save frame pointer for call
mov r4 r2                                                               ; 0x1392 -- stack frame address
constant r3 0x0001                                                      ; 0x1393 -- argument address size$1
add r3 r4 r3                                                            ; 0x1395
load r3 r3                                                              ; 0x1396 -- dereference size$1
sub r63 r63 r62                                                         ; 0x1397 -- push argument
store r63 r3                                                            ; 0x1398
constant r0 @global::system::alloc_4$                                   ; 0x1399 -- set up return address
jmp r1                                                                  ; 0x139b -- call
@global::system::alloc_4$:                                              ; 0x139c -- return address
mov r2 r0                                                               ; 0x139c
add r63 r63 r62                                                         ; 0x139d -- pop arguments
mov r0 r2                                                               ; 0x139e
constant r1 @global::system::alloc_return$                              ; 0x139f
jmp r1                                                                  ; 0x13a1
@global::system::alloc_return$:                                         ; 0x13a2
load r63 r63                                                            ; 0x13a2 -- restore sp
load r1 r63                                                             ; 0x13a3 -- pop return address
add r63 r63 r62                                                         ; 0x13a4
jmp r1                                                                  ; 0x13a5 -- return
@global::system::alloc_end$:                                            ; 0x13a6
@global::system::dealloc:                                               ; 0x13a6
@global::system::dealloc_start$:                                        ; 0x13a6
sub r63 r63 r62                                                         ; 0x13a6 -- push return address
store r63 r0                                                            ; 0x13a7
mov r1 r63                                                              ; 0x13a8 -- frame start
sub r63 r63 r62                                                         ; 0x13a9 -- push frame start
store r63 r1                                                            ; 0x13aa
constant r1 @global::system::_ensure_heap                               ; 0x13ab -- function address @global::system::_ensure_heap
constant r2 @global::system::dealloc_null_check_end_1$                  ; 0x13ad
jnz r1 r2                                                               ; 0x13af
constant r0 0xe0000000                                                  ; 0x13b0 -- null error
halt                                                                    ; 0x13b2
@global::system::dealloc_null_check_end_1$:                             ; 0x13b3
load r2 r63                                                             ; 0x13b3 -- save frame pointer for call
constant r0 @global::system::dealloc_2$                                 ; 0x13b4 -- set up return address
jmp r1                                                                  ; 0x13b6 -- call
@global::system::dealloc_2$:                                            ; 0x13b7 -- return address
mov r2 r0                                                               ; 0x13b7
constant r1 @global::std::dealloc                                       ; 0x13b8 -- function address @global::std::dealloc
constant r2 @global::system::dealloc_null_check_end_3$                  ; 0x13ba
jnz r1 r2                                                               ; 0x13bc
constant r0 0xe0000000                                                  ; 0x13bd -- null error
halt                                                                    ; 0x13bf
@global::system::dealloc_null_check_end_3$:                             ; 0x13c0
load r2 r63                                                             ; 0x13c0 -- save frame pointer for call
mov r4 r2                                                               ; 0x13c1 -- stack frame address
constant r3 0x0001                                                      ; 0x13c2 -- argument address pointer$1
add r3 r4 r3                                                            ; 0x13c4
load r3 r3                                                              ; 0x13c5 -- dereference pointer$1
sub r63 r63 r62                                                         ; 0x13c6 -- push argument
store r63 r3                                                            ; 0x13c7
constant r0 @global::system::dealloc_4$                                 ; 0x13c8 -- set up return address
jmp r1                                                                  ; 0x13ca -- call
@global::system::dealloc_4$:                                            ; 0x13cb -- return address
mov r2 r0                                                               ; 0x13cb
add r63 r63 r62                                                         ; 0x13cc -- pop arguments
@global::system::dealloc_return$:                                       ; 0x13cd
load r63 r63                                                            ; 0x13cd -- restore sp
load r1 r63                                                             ; 0x13ce -- pop return address
add r63 r63 r62                                                         ; 0x13cf
jmp r1                                                                  ; 0x13d0 -- return
@global::system::dealloc_end$:                                          ; 0x13d1
@global::lib::write:                                                    ; 0x13d1
@global::lib::write_start$:                                             ; 0x13d1
sub r63 r63 r62                                                         ; 0x13d1 -- push return address
store r63 r0                                                            ; 0x13d2
mov r1 r63                                                              ; 0x13d3 -- frame start
sub r63 r63 r62                                                         ; 0x13d4 -- push frame start
store r63 r1                                                            ; 0x13d5
constant r1 @global::lib::support::syscall2                             ; 0x13d6 -- function address @global::lib::support::syscall2
constant r2 @global::lib::write_null_check_end_1$                       ; 0x13d8
jnz r1 r2                                                               ; 0x13da
constant r0 0xe0000000                                                  ; 0x13db -- null error
halt                                                                    ; 0x13dd
@global::lib::write_null_check_end_1$:                                  ; 0x13de
load r2 r63                                                             ; 0x13de -- save frame pointer for call
constant r3 @global::lib::support::WRITE_SYSCALL                        ; 0x13df -- global address @global::lib::support::WRITE_SYSCALL
load r3 r3                                                              ; 0x13e1 -- dereference @global::lib::support::WRITE_SYSCALL
sub r63 r63 r62                                                         ; 0x13e2 -- push argument
store r63 r3                                                            ; 0x13e3
mov r4 r2                                                               ; 0x13e4 -- stack frame address
constant r3 0x0004                                                      ; 0x13e5 -- argument address handle$1
add r3 r4 r3                                                            ; 0x13e7
load r3 r3                                                              ; 0x13e8 -- dereference handle$1
sub r63 r63 r62                                                         ; 0x13e9 -- push argument
store r63 r3                                                            ; 0x13ea
mov r4 r2                                                               ; 0x13eb -- stack frame address
constant r3 0x0001                                                      ; 0x13ec -- argument address data$1
add r3 r4 r3                                                            ; 0x13ee
sub r63 r63 r62                                                         ; 0x13ef -- push argument
store r63 r3                                                            ; 0x13f0
constant r0 @global::lib::write_2$                                      ; 0x13f1 -- set up return address
jmp r1                                                                  ; 0x13f3 -- call
@global::lib::write_2$:                                                 ; 0x13f4 -- return address
mov r2 r0                                                               ; 0x13f4
constant r1 0x0003                                                      ; 0x13f5
add r63 r63 r1                                                          ; 0x13f7 -- pop arguments
mov r0 r2                                                               ; 0x13f8
constant r1 @global::lib::write_return$                                 ; 0x13f9
jmp r1                                                                  ; 0x13fb
@global::lib::write_return$:                                            ; 0x13fc
load r63 r63                                                            ; 0x13fc -- restore sp
load r1 r63                                                             ; 0x13fd -- pop return address
add r63 r63 r62                                                         ; 0x13fe
jmp r1                                                                  ; 0x13ff -- return
@global::lib::write_end$:                                               ; 0x1400
@global::lib::print:                                                    ; 0x1400
@global::lib::print_start$:                                             ; 0x1400
sub r63 r63 r62                                                         ; 0x1400 -- push return address
store r63 r0                                                            ; 0x1401
mov r1 r63                                                              ; 0x1402 -- frame start
sub r63 r63 r62                                                         ; 0x1403 -- push frame start
store r63 r1                                                            ; 0x1404
constant r1 @global::lib::write                                         ; 0x1405 -- function address @global::lib::write
constant r2 @global::lib::print_null_check_end_1$                       ; 0x1407
jnz r1 r2                                                               ; 0x1409
constant r0 0xe0000000                                                  ; 0x140a -- null error
halt                                                                    ; 0x140c
@global::lib::print_null_check_end_1$:                                  ; 0x140d
load r2 r63                                                             ; 0x140d -- save frame pointer for call
constant r3 @global::lib::handle::output                                ; 0x140e -- global address @global::lib::handle::output
load r3 r3                                                              ; 0x1410 -- dereference @global::lib::handle::output
sub r63 r63 r62                                                         ; 0x1411 -- push argument
store r63 r3                                                            ; 0x1412
mov r4 r2                                                               ; 0x1413 -- stack frame address
constant r3 0x0001                                                      ; 0x1414 -- argument address text$1
add r3 r4 r3                                                            ; 0x1416
constant r4 0x0003                                                      ; 0x1417
sub r63 r63 r4                                                          ; 0x1419
mov r4 r63                                                              ; 0x141a
load r5 r3                                                              ; 0x141b -- store argument
store r4 r5                                                             ; 0x141c
add r4 r4 r62                                                           ; 0x141d
add r3 r3 r62                                                           ; 0x141e
load r5 r3                                                              ; 0x141f -- copy word 1
store r4 r5                                                             ; 0x1420
add r4 r4 r62                                                           ; 0x1421
add r3 r3 r62                                                           ; 0x1422
load r5 r3                                                              ; 0x1423 -- copy word 2
store r4 r5                                                             ; 0x1424
add r4 r4 r62                                                           ; 0x1425
add r3 r3 r62                                                           ; 0x1426
constant r0 @global::lib::print_2$                                      ; 0x1427 -- set up return address
jmp r1                                                                  ; 0x1429 -- call
@global::lib::print_2$:                                                 ; 0x142a -- return address
mov r2 r0                                                               ; 0x142a
constant r1 0x0004                                                      ; 0x142b
add r63 r63 r1                                                          ; 0x142d -- pop arguments
mov r0 r2                                                               ; 0x142e
constant r1 @global::lib::print_return$                                 ; 0x142f
jmp r1                                                                  ; 0x1431
@global::lib::print_return$:                                            ; 0x1432
load r63 r63                                                            ; 0x1432 -- restore sp
load r1 r63                                                             ; 0x1433 -- pop return address
add r63 r63 r62                                                         ; 0x1434
jmp r1                                                                  ; 0x1435 -- return
@global::lib::print_end$:                                               ; 0x1436
@global::main:                                                          ; 0x1436
@global::main_start$:                                                   ; 0x1436
sub r63 r63 r62                                                         ; 0x1436 -- push return address
store r63 r0                                                            ; 0x1437
mov r1 r63                                                              ; 0x1438 -- frame start
constant r2 0x0011                                                      ; 0x1439 -- allocate local storage
sub r63 r63 r2                                                          ; 0x143b
sub r63 r63 r62                                                         ; 0x143c -- push frame start
store r63 r1                                                            ; 0x143d
load r2 r63                                                             ; 0x143e -- stack frame address
constant r1 0x0001                                                      ; 0x143f -- argument address args$1
add r1 r2 r1                                                            ; 0x1441
add r1 r1 r62                                                           ; 0x1442 -- length offset
load r1 r1                                                              ; 0x1443 -- len(args)
constant r2 0x0000                                                      ; 0x1444
eq r3 r1 r2                                                             ; 0x1446
constant r1 @global::main_else_1$                                       ; 0x1447
jz r3 r1                                                                ; 0x1449
constant r2 @global::lib::print                                         ; 0x144a -- function address @global::lib::print
constant r4 @global::main_null_check_end_3$                             ; 0x144c
jnz r2 r4                                                               ; 0x144e
constant r0 0xe0000000                                                  ; 0x144f -- null error
halt                                                                    ; 0x1451
@global::main_null_check_end_3$:                                        ; 0x1452
load r4 r63                                                             ; 0x1452 -- save frame pointer for call
sub r63 r63 r62                                                         ; 0x1453 -- push caller-save register
store r63 r1                                                            ; 0x1454
sub r63 r63 r62                                                         ; 0x1455 -- push caller-save register
store r63 r3                                                            ; 0x1456
mov r7 r4                                                               ; 0x1457 -- stack frame address
constant r5 0x000a                                                      ; 0x1458 -- local address string_literal_4
sub r5 r7 r5                                                            ; 0x145a
mov r6 r5                                                               ; 0x145b -- initialize destination pointer
constant r7 0x0028                                                      ; 0x145c
store r6 r7                                                             ; 0x145e -- store integral
add r6 r6 r62                                                           ; 0x145f -- next literal expression
constant r7 0x006e                                                      ; 0x1460
store r6 r7                                                             ; 0x1462 -- store integral
add r6 r6 r62                                                           ; 0x1463 -- next literal expression
constant r7 0x006f                                                      ; 0x1464
store r6 r7                                                             ; 0x1466 -- store integral
add r6 r6 r62                                                           ; 0x1467 -- next literal expression
constant r7 0x0020                                                      ; 0x1468
store r6 r7                                                             ; 0x146a -- store integral
add r6 r6 r62                                                           ; 0x146b -- next literal expression
constant r7 0x0061                                                      ; 0x146c
store r6 r7                                                             ; 0x146e -- store integral
add r6 r6 r62                                                           ; 0x146f -- next literal expression
constant r7 0x0072                                                      ; 0x1470
store r6 r7                                                             ; 0x1472 -- store integral
add r6 r6 r62                                                           ; 0x1473 -- next literal expression
constant r7 0x0067                                                      ; 0x1474
store r6 r7                                                             ; 0x1476 -- store integral
add r6 r6 r62                                                           ; 0x1477 -- next literal expression
constant r7 0x0073                                                      ; 0x1478
store r6 r7                                                             ; 0x147a -- store integral
add r6 r6 r62                                                           ; 0x147b -- next literal expression
constant r7 0x0029                                                      ; 0x147c
store r6 r7                                                             ; 0x147e -- store integral
add r6 r6 r62                                                           ; 0x147f -- next literal expression
constant r7 0x000a                                                      ; 0x1480
store r6 r7                                                             ; 0x1482 -- store integral
mov r7 r4                                                               ; 0x1483 -- stack frame address
constant r6 0x000d                                                      ; 0x1484 -- local address slice_temp_5
sub r6 r7 r6                                                            ; 0x1486
store r6 r5                                                             ; 0x1487 -- slice.pointer
constant r7 0x000a                                                      ; 0x1488 -- array length 10
add r6 r6 r62                                                           ; 0x148a
store r6 r7                                                             ; 0x148b -- slice.length
add r6 r6 r62                                                           ; 0x148c
store r6 r7                                                             ; 0x148d -- slice.capacity
mov r7 r4                                                               ; 0x148e -- stack frame address
constant r6 0x000d                                                      ; 0x148f -- local address slice_temp_5
sub r6 r7 r6                                                            ; 0x1491
constant r5 0x0003                                                      ; 0x1492
sub r63 r63 r5                                                          ; 0x1494
mov r5 r63                                                              ; 0x1495
load r7 r6                                                              ; 0x1496 -- store argument
store r5 r7                                                             ; 0x1497
add r5 r5 r62                                                           ; 0x1498
add r6 r6 r62                                                           ; 0x1499
load r7 r6                                                              ; 0x149a -- copy word 1
store r5 r7                                                             ; 0x149b
add r5 r5 r62                                                           ; 0x149c
add r6 r6 r62                                                           ; 0x149d
load r7 r6                                                              ; 0x149e -- copy word 2
store r5 r7                                                             ; 0x149f
add r5 r5 r62                                                           ; 0x14a0
add r6 r6 r62                                                           ; 0x14a1
constant r0 @global::main_6$                                            ; 0x14a2 -- set up return address
jmp r2                                                                  ; 0x14a4 -- call
@global::main_6$:                                                       ; 0x14a5 -- return address
mov r4 r0                                                               ; 0x14a5
constant r2 0x0003                                                      ; 0x14a6
add r63 r63 r2                                                          ; 0x14a8 -- pop arguments
load r3 r63                                                             ; 0x14a9 -- pop caller-save register
add r63 r63 r62                                                         ; 0x14aa
load r1 r63                                                             ; 0x14ab -- pop caller-save register
add r63 r63 r62                                                         ; 0x14ac
constant r1 @global::main_if_end_2$                                     ; 0x14ad
jmp r1                                                                  ; 0x14af
@global::main_else_1$:                                                  ; 0x14b0
constant r2 @global::lib::print                                         ; 0x14b0 -- function address @global::lib::print
constant r4 @global::main_null_check_end_7$                             ; 0x14b2
jnz r2 r4                                                               ; 0x14b4
constant r0 0xe0000000                                                  ; 0x14b5 -- null error
halt                                                                    ; 0x14b7
@global::main_null_check_end_7$:                                        ; 0x14b8
load r4 r63                                                             ; 0x14b8 -- save frame pointer for call
sub r63 r63 r62                                                         ; 0x14b9 -- push caller-save register
store r63 r1                                                            ; 0x14ba
sub r63 r63 r62                                                         ; 0x14bb -- push caller-save register
store r63 r3                                                            ; 0x14bc
mov r6 r4                                                               ; 0x14bd -- stack frame address
constant r5 0x0001                                                      ; 0x14be -- argument address args$1
add r5 r6 r5                                                            ; 0x14c0
constant r6 0x0003                                                      ; 0x14c1
sub r63 r63 r6                                                          ; 0x14c3
mov r6 r63                                                              ; 0x14c4
load r7 r5                                                              ; 0x14c5 -- store argument
store r6 r7                                                             ; 0x14c6
add r6 r6 r62                                                           ; 0x14c7
add r5 r5 r62                                                           ; 0x14c8
load r7 r5                                                              ; 0x14c9 -- copy word 1
store r6 r7                                                             ; 0x14ca
add r6 r6 r62                                                           ; 0x14cb
add r5 r5 r62                                                           ; 0x14cc
load r7 r5                                                              ; 0x14cd -- copy word 2
store r6 r7                                                             ; 0x14ce
add r6 r6 r62                                                           ; 0x14cf
add r5 r5 r62                                                           ; 0x14d0
constant r0 @global::main_8$                                            ; 0x14d1 -- set up return address
jmp r2                                                                  ; 0x14d3 -- call
@global::main_8$:                                                       ; 0x14d4 -- return address
mov r4 r0                                                               ; 0x14d4
constant r2 0x0003                                                      ; 0x14d5
add r63 r63 r2                                                          ; 0x14d7 -- pop arguments
load r3 r63                                                             ; 0x14d8 -- pop caller-save register
add r63 r63 r62                                                         ; 0x14d9
load r1 r63                                                             ; 0x14da -- pop caller-save register
add r63 r63 r62                                                         ; 0x14db
constant r2 @global::lib::print                                         ; 0x14dc -- function address @global::lib::print
constant r4 @global::main_null_check_end_9$                             ; 0x14de
jnz r2 r4                                                               ; 0x14e0
constant r0 0xe0000000                                                  ; 0x14e1 -- null error
halt                                                                    ; 0x14e3
@global::main_null_check_end_9$:                                        ; 0x14e4
load r4 r63                                                             ; 0x14e4 -- save frame pointer for call
sub r63 r63 r62                                                         ; 0x14e5 -- push caller-save register
store r63 r1                                                            ; 0x14e6
sub r63 r63 r62                                                         ; 0x14e7 -- push caller-save register
store r63 r3                                                            ; 0x14e8
mov r7 r4                                                               ; 0x14e9 -- stack frame address
constant r5 0x000e                                                      ; 0x14ea -- local address string_literal_10
sub r5 r7 r5                                                            ; 0x14ec
mov r6 r5                                                               ; 0x14ed -- initialize destination pointer
constant r7 0x000a                                                      ; 0x14ee
store r6 r7                                                             ; 0x14f0 -- store integral
mov r7 r4                                                               ; 0x14f1 -- stack frame address
constant r6 0x0011                                                      ; 0x14f2 -- local address slice_temp_11
sub r6 r7 r6                                                            ; 0x14f4
store r6 r5                                                             ; 0x14f5 -- slice.pointer
constant r7 0x0001                                                      ; 0x14f6 -- array length 1
add r6 r6 r62                                                           ; 0x14f8
store r6 r7                                                             ; 0x14f9 -- slice.length
add r6 r6 r62                                                           ; 0x14fa
store r6 r7                                                             ; 0x14fb -- slice.capacity
mov r7 r4                                                               ; 0x14fc -- stack frame address
constant r6 0x0011                                                      ; 0x14fd -- local address slice_temp_11
sub r6 r7 r6                                                            ; 0x14ff
constant r5 0x0003                                                      ; 0x1500
sub r63 r63 r5                                                          ; 0x1502
mov r5 r63                                                              ; 0x1503
load r7 r6                                                              ; 0x1504 -- store argument
store r5 r7                                                             ; 0x1505
add r5 r5 r62                                                           ; 0x1506
add r6 r6 r62                                                           ; 0x1507
load r7 r6                                                              ; 0x1508 -- copy word 1
store r5 r7                                                             ; 0x1509
add r5 r5 r62                                                           ; 0x150a
add r6 r6 r62                                                           ; 0x150b
load r7 r6                                                              ; 0x150c -- copy word 2
store r5 r7                                                             ; 0x150d
add r5 r5 r62                                                           ; 0x150e
add r6 r6 r62                                                           ; 0x150f
constant r0 @global::main_12$                                           ; 0x1510 -- set up return address
jmp r2                                                                  ; 0x1512 -- call
@global::main_12$:                                                      ; 0x1513 -- return address
mov r4 r0                                                               ; 0x1513
constant r2 0x0003                                                      ; 0x1514
add r63 r63 r2                                                          ; 0x1516 -- pop arguments
load r3 r63                                                             ; 0x1517 -- pop caller-save register
add r63 r63 r62                                                         ; 0x1518
load r1 r63                                                             ; 0x1519 -- pop caller-save register
add r63 r63 r62                                                         ; 0x151a
@global::main_if_end_2$:                                                ; 0x151b
constant r1 0x0000                                                      ; 0x151b
mov r0 r1                                                               ; 0x151d
constant r2 @global::main_return$                                       ; 0x151e
jmp r2                                                                  ; 0x1520
@global::main_return$:                                                  ; 0x1521
load r63 r63                                                            ; 0x1521 -- restore sp
load r1 r63                                                             ; 0x1522 -- pop return address
add r63 r63 r62                                                         ; 0x1523
jmp r1                                                                  ; 0x1524 -- return
@global::main_end$:                                                     ; 0x1525
@echo_data_2$:                                                          ; 0x1525
data @global::std::HEAP_SIZE 0x10000                                    ; 0x1525
data @global::std::SPLIT_THRESHOLD 0x100                                ; 0x1526
data @global::std::heap 0x00                                            ; 0x1527
data @global::std::blocks 0x00                                          ; 0x1528
data @global::std::buffered::READY 0x00                                 ; 0x1529
data @global::std::buffered::WRITE 0x01                                 ; 0x152a
data @global::std::buffered::READ 0x02                                  ; 0x152b
data @global::std::buffered::PENDING 0x03                               ; 0x152c
data @global::std::buffered::ERROR 0x04                                 ; 0x152d
data @`global::std::fmt::fmt_type::S` 0x01                              ; 0x152e
data @`global::std::fmt::fmt_type::U` 0x02                              ; 0x152f
data @`global::std::fmt::fmt_type::I` 0x03                              ; 0x1530
data @`global::std::fmt::fmt_type::P` 0x04                              ; 0x1531
data @global::std::fmt::nl 0x00 0x00 0x00 0x00 0x00 0x00 0x00           ; 0x1532 -- global global::std::fmt::nl
data @global::lib::support::EXIT_SYSCALL 0x00                           ; 0x1539
data @global::lib::support::READ_SYSCALL 0x01                           ; 0x153a
data @global::lib::support::WRITE_SYSCALL 0x02                          ; 0x153b
data @global::lib::support::OPEN_SYSCALL 0x03                           ; 0x153c
data @global::lib::support::CLOSE_SYSCALL 0x04                          ; 0x153d
data @global::lib::support::CREATE_SYSCALL 0x05                         ; 0x153e
data @global::lib::support::DESTROY_SYSCALL 0x06                        ; 0x153f
data @global::lib::support::SPAWN_SYSCALL 0x07                          ; 0x1540
data @global::lib::error::GENERIC_ERROR 0x00                            ; 0x1541 -- global global::lib::error::GENERIC_ERROR
data @global::lib::handle::input 0x02                                   ; 0x1542
data @global::lib::handle::output 0x01                                  ; 0x1543