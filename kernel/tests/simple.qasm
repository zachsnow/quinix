@simple_program_1$:                                                     ; 0x1000
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
mov r5 r4                                                               ; 0x102f -- store argument
mov r6 r3                                                               ; 0x1030
load r7 r6                                                              ; 0x1031 -- copy byte 0
store r5 r7                                                             ; 0x1032
add r5 r5 r62                                                           ; 0x1033
add r6 r6 r62                                                           ; 0x1034
load r7 r6                                                              ; 0x1035 -- copy byte 1
store r5 r7                                                             ; 0x1036
add r5 r5 r62                                                           ; 0x1037
add r6 r6 r62                                                           ; 0x1038
load r7 r6                                                              ; 0x1039 -- copy byte 2
store r5 r7                                                             ; 0x103a
constant r0 @global::std::fmt::nl_6$                                    ; 0x103b -- set up return address
jmp r1                                                                  ; 0x103d
@global::std::fmt::nl_6$:                                               ; 0x103e -- return address
mov r4 r0                                                               ; 0x103e
constant r1 0x0004                                                      ; 0x103f
add r63 r63 r1                                                          ; 0x1041 -- pop arguments
constant r1 @global::std::fmt::nl                                       ; 0x1042 -- reference global global::std::fmt::nl
mov r5 r1                                                               ; 0x1044 -- store to global global::std::fmt::nl
mov r6 r4                                                               ; 0x1045
load r7 r6                                                              ; 0x1046 -- copy byte 0
store r5 r7                                                             ; 0x1047
add r5 r5 r62                                                           ; 0x1048
add r6 r6 r62                                                           ; 0x1049
load r7 r6                                                              ; 0x104a -- copy byte 1
store r5 r7                                                             ; 0x104b
add r5 r5 r62                                                           ; 0x104c
add r6 r6 r62                                                           ; 0x104d
load r7 r6                                                              ; 0x104e -- copy byte 2
store r5 r7                                                             ; 0x104f
add r5 r5 r62                                                           ; 0x1050
add r6 r6 r62                                                           ; 0x1051
load r7 r6                                                              ; 0x1052 -- copy byte 3
store r5 r7                                                             ; 0x1053
add r5 r5 r62                                                           ; 0x1054
add r6 r6 r62                                                           ; 0x1055
load r7 r6                                                              ; 0x1056 -- copy byte 4
store r5 r7                                                             ; 0x1057
add r5 r5 r62                                                           ; 0x1058
add r6 r6 r62                                                           ; 0x1059
load r7 r6                                                              ; 0x105a -- copy byte 5
store r5 r7                                                             ; 0x105b
add r5 r5 r62                                                           ; 0x105c
add r6 r6 r62                                                           ; 0x105d
load r7 r6                                                              ; 0x105e -- copy byte 6
store r5 r7                                                             ; 0x105f
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
mov r3 r1                                                               ; 0x10a1 -- *(blocks) = { allocated = false, size = (HEAP_SIZE) - (sizeof block), next = null };
mov r4 r2                                                               ; 0x10a2
load r5 r4                                                              ; 0x10a3 -- copy byte 0
store r3 r5                                                             ; 0x10a4
add r3 r3 r62                                                           ; 0x10a5
add r4 r4 r62                                                           ; 0x10a6
load r5 r4                                                              ; 0x10a7 -- copy byte 1
store r3 r5                                                             ; 0x10a8
add r3 r3 r62                                                           ; 0x10a9
add r4 r4 r62                                                           ; 0x10aa
load r5 r4                                                              ; 0x10ab -- copy byte 2
store r3 r5                                                             ; 0x10ac
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
sub r63 r63 r62                                                         ; 0x1176 -- push caller-save register
store r63 r1                                                            ; 0x1177
sub r63 r63 r62                                                         ; 0x1178 -- push caller-save register
store r63 r2                                                            ; 0x1179
constant r0 @global::std::alloc_4$                                      ; 0x117a -- set up return address
jmp r3                                                                  ; 0x117c
@global::std::alloc_4$:                                                 ; 0x117d -- return address
mov r4 r0                                                               ; 0x117d
load r2 r63                                                             ; 0x117e -- pop caller-save register
add r63 r63 r62                                                         ; 0x117f
load r1 r63                                                             ; 0x1180 -- pop caller-save register
add r63 r63 r62                                                         ; 0x1181
constant r1 @global::std::alloc_if_end_2$                               ; 0x1182
jmp r1                                                                  ; 0x1184
@global::std::alloc_else_1$:                                            ; 0x1185
@global::std::alloc_if_end_2$:                                          ; 0x1185
constant r1 0x0000                                                      ; 0x1185
load r2 r63                                                             ; 0x1187 -- stack frame address
sub r2 r2 r62                                                           ; 0x1188 -- local address free_block$2
store r2 r1                                                             ; 0x1189 -- var free_block: * block = null;
constant r1 @global::std::blocks                                        ; 0x118a -- global address @global::std::blocks
load r1 r1                                                              ; 0x118c -- dereference @global::std::blocks
load r3 r63                                                             ; 0x118d -- stack frame address
constant r2 0x0002                                                      ; 0x118e -- local address b$3
sub r2 r3 r2                                                            ; 0x1190
store r2 r1                                                             ; 0x1191 -- var b = blocks
@global::std::alloc_for_5$:                                             ; 0x1192
load r3 r63                                                             ; 0x1192 -- stack frame address
constant r2 0x0002                                                      ; 0x1193 -- local address b$3
sub r2 r3 r2                                                            ; 0x1195
load r2 r2                                                              ; 0x1196 -- dereference b$3
constant r3 0x0000                                                      ; 0x1197 -- !(b)
eq r3 r3 r2                                                             ; 0x1199
constant r2 0x0000                                                      ; 0x119a -- !(!(b))
eq r2 r2 r3                                                             ; 0x119c
constant r1 @global::std::alloc_for_end_7$                              ; 0x119d
jz r2 r1                                                                ; 0x119f
load r4 r63                                                             ; 0x11a0 -- stack frame address
constant r3 0x0002                                                      ; 0x11a1 -- local address b$3
sub r3 r4 r3                                                            ; 0x11a3
load r3 r3                                                              ; 0x11a4 -- dereference b$3
constant r4 @global::std::alloc_null_check_end_8$                       ; 0x11a5
jnz r3 r4                                                               ; 0x11a7
constant r0 0xe0000000                                                  ; 0x11a8 -- null error
halt                                                                    ; 0x11aa
@global::std::alloc_null_check_end_8$:                                  ; 0x11ab
load r3 r3                                                              ; 0x11ab -- deference (b).allocated
constant r4 0x0000                                                      ; 0x11ac -- !((b).allocated)
eq r4 r4 r3                                                             ; 0x11ae
constant r3 @global::std::alloc_and_end_9$                              ; 0x11af
jz r4 r3                                                                ; 0x11b1
load r6 r63                                                             ; 0x11b2 -- stack frame address
constant r5 0x0002                                                      ; 0x11b3 -- local address b$3
sub r5 r6 r5                                                            ; 0x11b5
load r5 r5                                                              ; 0x11b6 -- dereference b$3
constant r6 @global::std::alloc_null_check_end_10$                      ; 0x11b7
jnz r5 r6                                                               ; 0x11b9
constant r0 0xe0000000                                                  ; 0x11ba -- null error
halt                                                                    ; 0x11bc
@global::std::alloc_null_check_end_10$:                                 ; 0x11bd
add r5 r5 r62                                                           ; 0x11bd -- ->size
load r5 r5                                                              ; 0x11be -- deference (b).size
load r7 r63                                                             ; 0x11bf -- stack frame address
constant r6 0x0001                                                      ; 0x11c0 -- argument address size$1
add r6 r7 r6                                                            ; 0x11c2
load r6 r6                                                              ; 0x11c3 -- dereference size$1
lt r7 r5 r6                                                             ; 0x11c4
constant r8 0x0000                                                      ; 0x11c5
eq r7 r7 r8                                                             ; 0x11c7
mov r4 r7                                                               ; 0x11c8
@global::std::alloc_and_end_9$:                                         ; 0x11c9 -- end &&
constant r5 @global::std::alloc_else_11$                                ; 0x11c9
jz r4 r5                                                                ; 0x11cb
load r6 r63                                                             ; 0x11cc -- stack frame address
sub r6 r6 r62                                                           ; 0x11cd -- local address free_block$2
load r8 r63                                                             ; 0x11ce -- stack frame address
constant r7 0x0002                                                      ; 0x11cf -- local address b$3
sub r7 r8 r7                                                            ; 0x11d1
load r7 r7                                                              ; 0x11d2 -- dereference b$3
store r6 r7                                                             ; 0x11d3 -- free_block = b;
constant r6 @global::std::alloc_for_end_7$                              ; 0x11d4
jmp r6                                                                  ; 0x11d6
constant r5 @global::std::alloc_if_end_12$                              ; 0x11d7
jmp r5                                                                  ; 0x11d9
@global::std::alloc_else_11$:                                           ; 0x11da
@global::std::alloc_if_end_12$:                                         ; 0x11da
@global::std::alloc_for_continue_6$:                                    ; 0x11da
load r5 r63                                                             ; 0x11da -- stack frame address
constant r4 0x0002                                                      ; 0x11db -- local address b$3
sub r4 r5 r4                                                            ; 0x11dd
load r6 r63                                                             ; 0x11de -- stack frame address
constant r5 0x0002                                                      ; 0x11df -- local address b$3
sub r5 r6 r5                                                            ; 0x11e1
load r5 r5                                                              ; 0x11e2 -- dereference b$3
constant r6 @global::std::alloc_null_check_end_13$                      ; 0x11e3
jnz r5 r6                                                               ; 0x11e5
constant r0 0xe0000000                                                  ; 0x11e6 -- null error
halt                                                                    ; 0x11e8
@global::std::alloc_null_check_end_13$:                                 ; 0x11e9
constant r6 0x0002                                                      ; 0x11e9
add r5 r5 r6                                                            ; 0x11eb -- ->next
load r5 r5                                                              ; 0x11ec -- deference (b).next
store r4 r5                                                             ; 0x11ed -- b = (b).next;
constant r1 @global::std::alloc_for_5$                                  ; 0x11ee
jmp r1                                                                  ; 0x11f0
@global::std::alloc_for_end_7$:                                         ; 0x11f1
load r1 r63                                                             ; 0x11f1 -- stack frame address
sub r1 r1 r62                                                           ; 0x11f2 -- local address free_block$2
load r1 r1                                                              ; 0x11f3 -- dereference free_block$2
constant r2 0x0000                                                      ; 0x11f4 -- !(free_block)
eq r2 r2 r1                                                             ; 0x11f6
constant r1 @global::std::alloc_else_14$                                ; 0x11f7
jz r2 r1                                                                ; 0x11f9
constant r4 0x0000                                                      ; 0x11fa
mov r0 r4                                                               ; 0x11fc
constant r5 @global::std::alloc_return$                                 ; 0x11fd
jmp r5                                                                  ; 0x11ff
constant r1 @global::std::alloc_if_end_15$                              ; 0x1200
jmp r1                                                                  ; 0x1202
@global::std::alloc_else_14$:                                           ; 0x1203
@global::std::alloc_if_end_15$:                                         ; 0x1203
load r1 r63                                                             ; 0x1203 -- stack frame address
sub r1 r1 r62                                                           ; 0x1204 -- local address free_block$2
load r1 r1                                                              ; 0x1205 -- dereference free_block$2
constant r2 @global::std::alloc_null_check_end_16$                      ; 0x1206
jnz r1 r2                                                               ; 0x1208
constant r0 0xe0000000                                                  ; 0x1209 -- null error
halt                                                                    ; 0x120b
@global::std::alloc_null_check_end_16$:                                 ; 0x120c
constant r2 0x0001                                                      ; 0x120c
store r1 r2                                                             ; 0x120e -- (free_block).allocated = true;
load r1 r63                                                             ; 0x120f -- stack frame address
sub r1 r1 r62                                                           ; 0x1210 -- local address free_block$2
load r1 r1                                                              ; 0x1211 -- dereference free_block$2
constant r2 0x0003                                                      ; 0x1212 -- sizeof block
add r4 r1 r2                                                            ; 0x1214
load r2 r63                                                             ; 0x1215 -- stack frame address
constant r1 0x0003                                                      ; 0x1216 -- local address ptr$2
sub r1 r2 r1                                                            ; 0x1218
store r1 r4                                                             ; 0x1219 -- var ptr = <* byte>((<byte>(free_block)) + (sizeof block))
load r1 r63                                                             ; 0x121a -- stack frame address
sub r1 r1 r62                                                           ; 0x121b -- local address free_block$2
load r1 r1                                                              ; 0x121c -- dereference free_block$2
constant r2 @global::std::alloc_null_check_end_17$                      ; 0x121d
jnz r1 r2                                                               ; 0x121f
constant r0 0xe0000000                                                  ; 0x1220 -- null error
halt                                                                    ; 0x1222
@global::std::alloc_null_check_end_17$:                                 ; 0x1223
add r1 r1 r62                                                           ; 0x1223 -- ->size
load r1 r1                                                              ; 0x1224 -- deference (free_block).size
load r4 r63                                                             ; 0x1225 -- stack frame address
constant r2 0x0001                                                      ; 0x1226 -- argument address size$1
add r2 r4 r2                                                            ; 0x1228
load r2 r2                                                              ; 0x1229 -- dereference size$1
sub r4 r1 r2                                                            ; 0x122a
constant r1 0x0003                                                      ; 0x122b -- sizeof block
constant r2 @global::std::SPLIT_THRESHOLD                               ; 0x122d -- global address @global::std::SPLIT_THRESHOLD
load r2 r2                                                              ; 0x122f -- dereference @global::std::SPLIT_THRESHOLD
add r5 r1 r2                                                            ; 0x1230
gt r1 r4 r5                                                             ; 0x1231
constant r2 @global::std::alloc_else_18$                                ; 0x1232
jz r1 r2                                                                ; 0x1234
load r5 r63                                                             ; 0x1235 -- stack frame address
constant r4 0x0003                                                      ; 0x1236 -- local address ptr$2
sub r4 r5 r4                                                            ; 0x1238
load r4 r4                                                              ; 0x1239 -- dereference ptr$2
load r6 r63                                                             ; 0x123a -- stack frame address
constant r5 0x0001                                                      ; 0x123b -- argument address size$1
add r5 r6 r5                                                            ; 0x123d
load r5 r5                                                              ; 0x123e -- dereference size$1
add r6 r4 r5                                                            ; 0x123f
load r5 r63                                                             ; 0x1240 -- stack frame address
constant r4 0x0004                                                      ; 0x1241 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1243
store r4 r6                                                             ; 0x1244 -- var split_block = <* block>((<byte>(ptr)) + (size))
load r5 r63                                                             ; 0x1245 -- stack frame address
constant r4 0x0004                                                      ; 0x1246 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1248
load r4 r4                                                              ; 0x1249 -- dereference split_block$3
constant r5 @global::std::alloc_null_check_end_20$                      ; 0x124a
jnz r4 r5                                                               ; 0x124c
constant r0 0xe0000000                                                  ; 0x124d -- null error
halt                                                                    ; 0x124f
@global::std::alloc_null_check_end_20$:                                 ; 0x1250
constant r5 0x0000                                                      ; 0x1250
store r4 r5                                                             ; 0x1252 -- (split_block).allocated = false;
load r5 r63                                                             ; 0x1253 -- stack frame address
constant r4 0x0004                                                      ; 0x1254 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1256
load r4 r4                                                              ; 0x1257 -- dereference split_block$3
constant r5 @global::std::alloc_null_check_end_21$                      ; 0x1258
jnz r4 r5                                                               ; 0x125a
constant r0 0xe0000000                                                  ; 0x125b -- null error
halt                                                                    ; 0x125d
@global::std::alloc_null_check_end_21$:                                 ; 0x125e
add r4 r4 r62                                                           ; 0x125e -- ->size
load r5 r63                                                             ; 0x125f -- stack frame address
sub r5 r5 r62                                                           ; 0x1260 -- local address free_block$2
load r5 r5                                                              ; 0x1261 -- dereference free_block$2
constant r6 @global::std::alloc_null_check_end_22$                      ; 0x1262
jnz r5 r6                                                               ; 0x1264
constant r0 0xe0000000                                                  ; 0x1265 -- null error
halt                                                                    ; 0x1267
@global::std::alloc_null_check_end_22$:                                 ; 0x1268
add r5 r5 r62                                                           ; 0x1268 -- ->size
load r5 r5                                                              ; 0x1269 -- deference (free_block).size
load r7 r63                                                             ; 0x126a -- stack frame address
constant r6 0x0001                                                      ; 0x126b -- argument address size$1
add r6 r7 r6                                                            ; 0x126d
load r6 r6                                                              ; 0x126e -- dereference size$1
sub r7 r5 r6                                                            ; 0x126f
constant r5 0x0003                                                      ; 0x1270 -- sizeof block
sub r6 r7 r5                                                            ; 0x1272
store r4 r6                                                             ; 0x1273 -- (split_block).size = (((free_block).size) - (size)) - (sizeof block);
load r5 r63                                                             ; 0x1274 -- stack frame address
constant r4 0x0004                                                      ; 0x1275 -- local address split_block$3
sub r4 r5 r4                                                            ; 0x1277
load r4 r4                                                              ; 0x1278 -- dereference split_block$3
constant r5 @global::std::alloc_null_check_end_23$                      ; 0x1279
jnz r4 r5                                                               ; 0x127b
constant r0 0xe0000000                                                  ; 0x127c -- null error
halt                                                                    ; 0x127e
@global::std::alloc_null_check_end_23$:                                 ; 0x127f
constant r5 0x0002                                                      ; 0x127f
add r4 r4 r5                                                            ; 0x1281 -- ->next
load r5 r63                                                             ; 0x1282 -- stack frame address
sub r5 r5 r62                                                           ; 0x1283 -- local address free_block$2
load r5 r5                                                              ; 0x1284 -- dereference free_block$2
constant r6 @global::std::alloc_null_check_end_24$                      ; 0x1285
jnz r5 r6                                                               ; 0x1287
constant r0 0xe0000000                                                  ; 0x1288 -- null error
halt                                                                    ; 0x128a
@global::std::alloc_null_check_end_24$:                                 ; 0x128b
constant r6 0x0002                                                      ; 0x128b
add r5 r5 r6                                                            ; 0x128d -- ->next
load r5 r5                                                              ; 0x128e -- deference (free_block).next
store r4 r5                                                             ; 0x128f -- (split_block).next = (free_block).next;
load r4 r63                                                             ; 0x1290 -- stack frame address
sub r4 r4 r62                                                           ; 0x1291 -- local address free_block$2
load r4 r4                                                              ; 0x1292 -- dereference free_block$2
constant r5 @global::std::alloc_null_check_end_25$                      ; 0x1293
jnz r4 r5                                                               ; 0x1295
constant r0 0xe0000000                                                  ; 0x1296 -- null error
halt                                                                    ; 0x1298
@global::std::alloc_null_check_end_25$:                                 ; 0x1299
add r4 r4 r62                                                           ; 0x1299 -- ->size
load r6 r63                                                             ; 0x129a -- stack frame address
constant r5 0x0001                                                      ; 0x129b -- argument address size$1
add r5 r6 r5                                                            ; 0x129d
load r5 r5                                                              ; 0x129e -- dereference size$1
store r4 r5                                                             ; 0x129f -- (free_block).size = size;
load r4 r63                                                             ; 0x12a0 -- stack frame address
sub r4 r4 r62                                                           ; 0x12a1 -- local address free_block$2
load r4 r4                                                              ; 0x12a2 -- dereference free_block$2
constant r5 @global::std::alloc_null_check_end_26$                      ; 0x12a3
jnz r4 r5                                                               ; 0x12a5
constant r0 0xe0000000                                                  ; 0x12a6 -- null error
halt                                                                    ; 0x12a8
@global::std::alloc_null_check_end_26$:                                 ; 0x12a9
constant r5 0x0002                                                      ; 0x12a9
add r4 r4 r5                                                            ; 0x12ab -- ->next
load r6 r63                                                             ; 0x12ac -- stack frame address
constant r5 0x0004                                                      ; 0x12ad -- local address split_block$3
sub r5 r6 r5                                                            ; 0x12af
load r5 r5                                                              ; 0x12b0 -- dereference split_block$3
store r4 r5                                                             ; 0x12b1 -- (free_block).next = split_block;
constant r2 @global::std::alloc_if_end_19$                              ; 0x12b2
jmp r2                                                                  ; 0x12b4
@global::std::alloc_else_18$:                                           ; 0x12b5
@global::std::alloc_if_end_19$:                                         ; 0x12b5
load r2 r63                                                             ; 0x12b5 -- stack frame address
constant r1 0x0003                                                      ; 0x12b6 -- local address ptr$2
sub r1 r2 r1                                                            ; 0x12b8
load r1 r1                                                              ; 0x12b9 -- dereference ptr$2
mov r0 r1                                                               ; 0x12ba
constant r2 @global::std::alloc_return$                                 ; 0x12bb
jmp r2                                                                  ; 0x12bd
@global::std::alloc_return$:                                            ; 0x12be
load r63 r63                                                            ; 0x12be -- restore sp
load r1 r63                                                             ; 0x12bf -- pop return address
add r63 r63 r62                                                         ; 0x12c0
jmp r1                                                                  ; 0x12c1 -- return
@global::std::alloc_end$:                                               ; 0x12c2
@global::std::dealloc:                                                  ; 0x12c2
@global::std::dealloc_start$:                                           ; 0x12c2
sub r63 r63 r62                                                         ; 0x12c2 -- push return address
store r63 r0                                                            ; 0x12c3
mov r1 r63                                                              ; 0x12c4 -- frame start
sub r63 r63 r62                                                         ; 0x12c5 -- allocate local storage
sub r63 r63 r62                                                         ; 0x12c6 -- push frame start
store r63 r1                                                            ; 0x12c7
load r2 r63                                                             ; 0x12c8 -- stack frame address
constant r1 0x0001                                                      ; 0x12c9 -- argument address pointer$1
add r1 r2 r1                                                            ; 0x12cb
load r1 r1                                                              ; 0x12cc -- dereference pointer$1
constant r2 0x0000                                                      ; 0x12cd -- !(pointer)
eq r2 r2 r1                                                             ; 0x12cf
constant r1 @global::std::dealloc_else_1$                               ; 0x12d0
jz r2 r1                                                                ; 0x12d2
constant r3 0x0000                                                      ; 0x12d3
mov r0 r3                                                               ; 0x12d5
constant r4 @global::std::dealloc_return$                               ; 0x12d6
jmp r4                                                                  ; 0x12d8
constant r1 @global::std::dealloc_if_end_2$                             ; 0x12d9
jmp r1                                                                  ; 0x12db
@global::std::dealloc_else_1$:                                          ; 0x12dc
@global::std::dealloc_if_end_2$:                                        ; 0x12dc
load r2 r63                                                             ; 0x12dc -- stack frame address
constant r1 0x0001                                                      ; 0x12dd -- argument address pointer$1
add r1 r2 r1                                                            ; 0x12df
load r1 r1                                                              ; 0x12e0 -- dereference pointer$1
constant r2 0x0003                                                      ; 0x12e1 -- sizeof block
sub r3 r1 r2                                                            ; 0x12e3
load r1 r63                                                             ; 0x12e4 -- stack frame address
sub r1 r1 r62                                                           ; 0x12e5 -- local address b$2
store r1 r3                                                             ; 0x12e6 -- var b = <* block>((<byte>(pointer)) - (sizeof block))
load r1 r63                                                             ; 0x12e7 -- stack frame address
sub r1 r1 r62                                                           ; 0x12e8 -- local address b$2
load r1 r1                                                              ; 0x12e9 -- dereference b$2
constant r2 @global::std::dealloc_null_check_end_3$                     ; 0x12ea
jnz r1 r2                                                               ; 0x12ec
constant r0 0xe0000000                                                  ; 0x12ed -- null error
halt                                                                    ; 0x12ef
@global::std::dealloc_null_check_end_3$:                                ; 0x12f0
constant r2 0x0000                                                      ; 0x12f0
store r1 r2                                                             ; 0x12f2 -- (b).allocated = false;
constant r1 @global::std::_merge_blocks                                 ; 0x12f3 -- function address @global::std::_merge_blocks
constant r2 @global::std::dealloc_null_check_end_4$                     ; 0x12f5
jnz r1 r2                                                               ; 0x12f7
constant r0 0xe0000000                                                  ; 0x12f8 -- null error
halt                                                                    ; 0x12fa
@global::std::dealloc_null_check_end_4$:                                ; 0x12fb
constant r0 @global::std::dealloc_5$                                    ; 0x12fb -- set up return address
jmp r1                                                                  ; 0x12fd
@global::std::dealloc_5$:                                               ; 0x12fe -- return address
mov r2 r0                                                               ; 0x12fe
@global::std::dealloc_return$:                                          ; 0x12ff
load r63 r63                                                            ; 0x12ff -- restore sp
load r1 r63                                                             ; 0x1300 -- pop return address
add r63 r63 r62                                                         ; 0x1301
jmp r1                                                                  ; 0x1302 -- return
@global::std::dealloc_end$:                                             ; 0x1303
@global::std::fmt::fs:                                                  ; 0x1303
@global::std::fmt::fs_start$:                                           ; 0x1303
sub r63 r63 r62                                                         ; 0x1303 -- push return address
store r63 r0                                                            ; 0x1304
mov r1 r63                                                              ; 0x1305 -- frame start
constant r2 0x0007                                                      ; 0x1306 -- allocate local storage
sub r63 r63 r2                                                          ; 0x1308
sub r63 r63 r62                                                         ; 0x1309 -- push frame start
store r63 r1                                                            ; 0x130a
load r3 r63                                                             ; 0x130b -- stack frame address
constant r1 0x0007                                                      ; 0x130c -- local address struct_literal_1
sub r1 r3 r1                                                            ; 0x130e
mov r2 r1                                                               ; 0x130f -- initialize destination pointer
constant r3 @`global::std::fmt::fmt_type::S`                            ; 0x1310 -- global address @`global::std::fmt::fmt_type::S`
load r3 r3                                                              ; 0x1312 -- dereference @`global::std::fmt::fmt_type::S`
store r2 r3                                                             ; 0x1313 -- store integral
add r2 r2 r62                                                           ; 0x1314 -- next literal expression
constant r3 0x0000                                                      ; 0x1315
store r2 r3                                                             ; 0x1317
add r2 r2 r62                                                           ; 0x1318 -- next literal expression
constant r3 0x0000                                                      ; 0x1319
store r2 r3                                                             ; 0x131b
add r2 r2 r62                                                           ; 0x131c -- next literal expression
load r4 r63                                                             ; 0x131d -- stack frame address
constant r3 0x0001                                                      ; 0x131e -- argument address s$1
add r3 r4 r3                                                            ; 0x1320
mov r4 r2                                                               ; 0x1321 -- copy non-integral
mov r5 r3                                                               ; 0x1322
load r6 r5                                                              ; 0x1323 -- copy byte 0
store r4 r6                                                             ; 0x1324
add r4 r4 r62                                                           ; 0x1325
add r5 r5 r62                                                           ; 0x1326
load r6 r5                                                              ; 0x1327 -- copy byte 1
store r4 r6                                                             ; 0x1328
add r4 r4 r62                                                           ; 0x1329
add r5 r5 r62                                                           ; 0x132a
load r6 r5                                                              ; 0x132b -- copy byte 2
store r4 r6                                                             ; 0x132c
constant r3 0x0003                                                      ; 0x132d
add r2 r2 r3                                                            ; 0x132f -- next literal expression
constant r3 0x0000                                                      ; 0x1330
store r2 r3                                                             ; 0x1332
load r3 r63                                                             ; 0x1333 -- stack frame address
constant r2 0x0004                                                      ; 0x1334 -- argument address $return
add r2 r3 r2                                                            ; 0x1336
load r2 r2                                                              ; 0x1337 -- dereference $return
mov r3 r2                                                               ; 0x1338 -- copy return data
mov r4 r1                                                               ; 0x1339
load r5 r4                                                              ; 0x133a -- copy byte 0
store r3 r5                                                             ; 0x133b
add r3 r3 r62                                                           ; 0x133c
add r4 r4 r62                                                           ; 0x133d
load r5 r4                                                              ; 0x133e -- copy byte 1
store r3 r5                                                             ; 0x133f
add r3 r3 r62                                                           ; 0x1340
add r4 r4 r62                                                           ; 0x1341
load r5 r4                                                              ; 0x1342 -- copy byte 2
store r3 r5                                                             ; 0x1343
add r3 r3 r62                                                           ; 0x1344
add r4 r4 r62                                                           ; 0x1345
load r5 r4                                                              ; 0x1346 -- copy byte 3
store r3 r5                                                             ; 0x1347
add r3 r3 r62                                                           ; 0x1348
add r4 r4 r62                                                           ; 0x1349
load r5 r4                                                              ; 0x134a -- copy byte 4
store r3 r5                                                             ; 0x134b
add r3 r3 r62                                                           ; 0x134c
add r4 r4 r62                                                           ; 0x134d
load r5 r4                                                              ; 0x134e -- copy byte 5
store r3 r5                                                             ; 0x134f
add r3 r3 r62                                                           ; 0x1350
add r4 r4 r62                                                           ; 0x1351
load r5 r4                                                              ; 0x1352 -- copy byte 6
store r3 r5                                                             ; 0x1353
mov r1 r2                                                               ; 0x1354
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
constant r0 @global::system::alloc_2$                                   ; 0x1384 -- set up return address
jmp r1                                                                  ; 0x1386
@global::system::alloc_2$:                                              ; 0x1387 -- return address
mov r2 r0                                                               ; 0x1387
constant r1 @global::std::alloc                                         ; 0x1388 -- function address @global::std::alloc
constant r2 @global::system::alloc_null_check_end_3$                    ; 0x138a
jnz r1 r2                                                               ; 0x138c
constant r0 0xe0000000                                                  ; 0x138d -- null error
halt                                                                    ; 0x138f
@global::system::alloc_null_check_end_3$:                               ; 0x1390
load r3 r63                                                             ; 0x1390 -- stack frame address
constant r2 0x0001                                                      ; 0x1391 -- argument address size$1
add r2 r3 r2                                                            ; 0x1393
load r2 r2                                                              ; 0x1394 -- dereference size$1
sub r63 r63 r62                                                         ; 0x1395 -- push argument
store r63 r2                                                            ; 0x1396
constant r0 @global::system::alloc_4$                                   ; 0x1397 -- set up return address
jmp r1                                                                  ; 0x1399
@global::system::alloc_4$:                                              ; 0x139a -- return address
mov r3 r0                                                               ; 0x139a
add r63 r63 r62                                                         ; 0x139b -- pop arguments
mov r0 r3                                                               ; 0x139c
constant r1 @global::system::alloc_return$                              ; 0x139d
jmp r1                                                                  ; 0x139f
@global::system::alloc_return$:                                         ; 0x13a0
load r63 r63                                                            ; 0x13a0 -- restore sp
load r1 r63                                                             ; 0x13a1 -- pop return address
add r63 r63 r62                                                         ; 0x13a2
jmp r1                                                                  ; 0x13a3 -- return
@global::system::alloc_end$:                                            ; 0x13a4
@global::system::dealloc:                                               ; 0x13a4
@global::system::dealloc_start$:                                        ; 0x13a4
sub r63 r63 r62                                                         ; 0x13a4 -- push return address
store r63 r0                                                            ; 0x13a5
mov r1 r63                                                              ; 0x13a6 -- frame start
sub r63 r63 r62                                                         ; 0x13a7 -- push frame start
store r63 r1                                                            ; 0x13a8
constant r1 @global::system::_ensure_heap                               ; 0x13a9 -- function address @global::system::_ensure_heap
constant r2 @global::system::dealloc_null_check_end_1$                  ; 0x13ab
jnz r1 r2                                                               ; 0x13ad
constant r0 0xe0000000                                                  ; 0x13ae -- null error
halt                                                                    ; 0x13b0
@global::system::dealloc_null_check_end_1$:                             ; 0x13b1
constant r0 @global::system::dealloc_2$                                 ; 0x13b1 -- set up return address
jmp r1                                                                  ; 0x13b3
@global::system::dealloc_2$:                                            ; 0x13b4 -- return address
mov r2 r0                                                               ; 0x13b4
constant r1 @global::std::dealloc                                       ; 0x13b5 -- function address @global::std::dealloc
constant r2 @global::system::dealloc_null_check_end_3$                  ; 0x13b7
jnz r1 r2                                                               ; 0x13b9
constant r0 0xe0000000                                                  ; 0x13ba -- null error
halt                                                                    ; 0x13bc
@global::system::dealloc_null_check_end_3$:                             ; 0x13bd
load r3 r63                                                             ; 0x13bd -- stack frame address
constant r2 0x0001                                                      ; 0x13be -- argument address pointer$1
add r2 r3 r2                                                            ; 0x13c0
load r2 r2                                                              ; 0x13c1 -- dereference pointer$1
sub r63 r63 r62                                                         ; 0x13c2 -- push argument
store r63 r2                                                            ; 0x13c3
constant r0 @global::system::dealloc_4$                                 ; 0x13c4 -- set up return address
jmp r1                                                                  ; 0x13c6
@global::system::dealloc_4$:                                            ; 0x13c7 -- return address
mov r3 r0                                                               ; 0x13c7
add r63 r63 r62                                                         ; 0x13c8 -- pop arguments
@global::system::dealloc_return$:                                       ; 0x13c9
load r63 r63                                                            ; 0x13c9 -- restore sp
load r1 r63                                                             ; 0x13ca -- pop return address
add r63 r63 r62                                                         ; 0x13cb
jmp r1                                                                  ; 0x13cc -- return
@global::system::dealloc_end$:                                          ; 0x13cd
@global::lib::exit:                                                     ; 0x13cd
@global::lib::exit_start$:                                              ; 0x13cd
sub r63 r63 r62                                                         ; 0x13cd -- push return address
store r63 r0                                                            ; 0x13ce
mov r1 r63                                                              ; 0x13cf -- frame start
sub r63 r63 r62                                                         ; 0x13d0 -- push frame start
store r63 r1                                                            ; 0x13d1
constant r1 @global::lib::support::syscall1                             ; 0x13d2 -- function address @global::lib::support::syscall1
constant r2 @global::lib::exit_null_check_end_1$                        ; 0x13d4
jnz r1 r2                                                               ; 0x13d6
constant r0 0xe0000000                                                  ; 0x13d7 -- null error
halt                                                                    ; 0x13d9
@global::lib::exit_null_check_end_1$:                                   ; 0x13da
constant r2 @global::lib::support::EXIT_SYSCALL                         ; 0x13da -- global address @global::lib::support::EXIT_SYSCALL
load r2 r2                                                              ; 0x13dc -- dereference @global::lib::support::EXIT_SYSCALL
load r4 r63                                                             ; 0x13dd -- stack frame address
constant r3 0x0001                                                      ; 0x13de -- argument address code$1
add r3 r4 r3                                                            ; 0x13e0
load r3 r3                                                              ; 0x13e1 -- dereference code$1
sub r63 r63 r62                                                         ; 0x13e2 -- push argument
store r63 r2                                                            ; 0x13e3
sub r63 r63 r62                                                         ; 0x13e4 -- push argument
store r63 r3                                                            ; 0x13e5
constant r0 @global::lib::exit_2$                                       ; 0x13e6 -- set up return address
jmp r1                                                                  ; 0x13e8
@global::lib::exit_2$:                                                  ; 0x13e9 -- return address
mov r4 r0                                                               ; 0x13e9
constant r1 0x0002                                                      ; 0x13ea
add r63 r63 r1                                                          ; 0x13ec -- pop arguments
@global::lib::exit_return$:                                             ; 0x13ed
load r63 r63                                                            ; 0x13ed -- restore sp
load r1 r63                                                             ; 0x13ee -- pop return address
add r63 r63 r62                                                         ; 0x13ef
jmp r1                                                                  ; 0x13f0 -- return
@global::lib::exit_end$:                                                ; 0x13f1
@global::main:                                                          ; 0x13f1
@global::main_start$:                                                   ; 0x13f1
sub r63 r63 r62                                                         ; 0x13f1 -- push return address
store r63 r0                                                            ; 0x13f2
mov r1 r63                                                              ; 0x13f3 -- frame start
sub r63 r63 r62                                                         ; 0x13f4 -- push frame start
store r63 r1                                                            ; 0x13f5
constant r1 @global::lib::exit                                          ; 0x13f6 -- function address @global::lib::exit
constant r2 @global::main_null_check_end_1$                             ; 0x13f8
jnz r1 r2                                                               ; 0x13fa
constant r0 0xe0000000                                                  ; 0x13fb -- null error
halt                                                                    ; 0x13fd
@global::main_null_check_end_1$:                                        ; 0x13fe
constant r2 0x002a                                                      ; 0x13fe
sub r63 r63 r62                                                         ; 0x1400 -- push argument
store r63 r2                                                            ; 0x1401
constant r0 @global::main_2$                                            ; 0x1402 -- set up return address
jmp r1                                                                  ; 0x1404
@global::main_2$:                                                       ; 0x1405 -- return address
mov r3 r0                                                               ; 0x1405
add r63 r63 r62                                                         ; 0x1406 -- pop arguments
constant r1 0x0000                                                      ; 0x1407
mov r0 r1                                                               ; 0x1409
constant r3 @global::main_return$                                       ; 0x140a
jmp r3                                                                  ; 0x140c
@global::main_return$:                                                  ; 0x140d
load r63 r63                                                            ; 0x140d -- restore sp
load r1 r63                                                             ; 0x140e -- pop return address
add r63 r63 r62                                                         ; 0x140f
jmp r1                                                                  ; 0x1410 -- return
@global::main_end$:                                                     ; 0x1411
@simple_data_2$:                                                        ; 0x1411
data @global::std::HEAP_SIZE 0x10000                                    ; 0x1411
data @global::std::SPLIT_THRESHOLD 0x100                                ; 0x1412
data @global::std::heap 0x00                                            ; 0x1413
data @global::std::blocks 0x00                                          ; 0x1414
data @global::std::buffered::READY 0x00                                 ; 0x1415
data @global::std::buffered::WRITE 0x01                                 ; 0x1416
data @global::std::buffered::READ 0x02                                  ; 0x1417
data @global::std::buffered::PENDING 0x03                               ; 0x1418
data @global::std::buffered::ERROR 0x04                                 ; 0x1419
data @`global::std::fmt::fmt_type::S` 0x01                              ; 0x141a
data @`global::std::fmt::fmt_type::U` 0x02                              ; 0x141b
data @`global::std::fmt::fmt_type::I` 0x03                              ; 0x141c
data @`global::std::fmt::fmt_type::P` 0x04                              ; 0x141d
data @global::std::fmt::nl 0x00 0x00 0x00 0x00 0x00 0x00 0x00           ; 0x141e -- global global::std::fmt::nl
data @global::lib::support::EXIT_SYSCALL 0x00                           ; 0x1425
data @global::lib::support::READ_SYSCALL 0x01                           ; 0x1426
data @global::lib::support::WRITE_SYSCALL 0x02                          ; 0x1427
data @global::lib::support::OPEN_SYSCALL 0x03                           ; 0x1428
data @global::lib::support::CLOSE_SYSCALL 0x04                          ; 0x1429
data @global::lib::support::CREATE_SYSCALL 0x05                         ; 0x142a
data @global::lib::support::DESTROY_SYSCALL 0x06                        ; 0x142b
data @global::lib::support::SPAWN_SYSCALL 0x07                          ; 0x142c
data @global::lib::error::GENERIC_ERROR 0x00                            ; 0x142d -- global global::lib::error::GENERIC_ERROR
data @global::lib::handle::input 0x02                                   ; 0x142e
data @global::lib::handle::output 0x01                                  ; 0x142f