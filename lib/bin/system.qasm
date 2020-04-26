@system_data_1$:                                                        ; 0x1000
data @system::HEAP_SIZE 0x2000                                          ; 0x1000
data @system::SPLIT_THRESHOLD 0x100                                     ; 0x1001
data @system::heap 0x8000                                               ; 0x1002
data @system::blocks 0x00                                               ; 0x1003
@system_program_2$:                                                     ; 0x1004
@system::_init:                                                         ; 0x1004
@system::_init_start$:                                                  ; 0x1004
sub r63 r63 r62                                                         ; 0x1004 -- push return address
store r63 r0                                                            ; 0x1005
mov r1 r63                                                              ; 0x1006 -- frame start
constant r2 0x0003                                                      ; 0x1007 -- allocate local storage
sub r63 r63 r2                                                          ; 0x1009
sub r63 r63 r62                                                         ; 0x100a -- push frame start
store r63 r1                                                            ; 0x100b
constant r1 @system::blocks                                             ; 0x100c -- global address @system::blocks
constant r2 @system::heap                                               ; 0x100e -- global address @system::heap
load r2 r2                                                              ; 0x1010 -- dereference @system::heap
store r1 r2                                                             ; 0x1011 -- blocks = <* block>(heap);
constant r1 @system::blocks                                             ; 0x1012 -- global address @system::blocks
load r1 r1                                                              ; 0x1014 -- dereference @system::blocks
load r4 r63                                                             ; 0x1015 -- stack frame address
constant r2 0x0003                                                      ; 0x1016 -- local address struct_literal_1
sub r2 r4 r2                                                            ; 0x1018
mov r3 r2                                                               ; 0x1019 -- initialize destination pointer
constant r4 0x0000                                                      ; 0x101a
store r3 r4                                                             ; 0x101c -- store integral
constant r4 0x0001                                                      ; 0x101d -- next literal expression size
add r3 r3 r4                                                            ; 0x101f -- next literal expression
constant r4 @system::HEAP_SIZE                                          ; 0x1020 -- global address @system::HEAP_SIZE
load r4 r4                                                              ; 0x1022 -- dereference @system::HEAP_SIZE
constant r5 0x0003                                                      ; 0x1023 -- sizeof block
sub r6 r4 r5                                                            ; 0x1025
store r3 r6                                                             ; 0x1026 -- store integral
constant r4 0x0001                                                      ; 0x1027 -- next literal expression size
add r3 r3 r4                                                            ; 0x1029 -- next literal expression
constant r4 0x0000                                                      ; 0x102a
store r3 r4                                                             ; 0x102c -- store integral
mov r3 r1                                                               ; 0x102d -- *(blocks) = { allocated = false, size = (HEAP_SIZE) - (sizeof block), next = <.unsafe * block>(null) };
mov r4 r2                                                               ; 0x102e
load r5 r4                                                              ; 0x102f
store r3 r5                                                             ; 0x1030
add r3 r3 r62                                                           ; 0x1031
add r4 r4 r62                                                           ; 0x1032
load r5 r4                                                              ; 0x1033
store r3 r5                                                             ; 0x1034
add r3 r3 r62                                                           ; 0x1035
add r4 r4 r62                                                           ; 0x1036
load r5 r4                                                              ; 0x1037
store r3 r5                                                             ; 0x1038
@system::_init_return$:                                                 ; 0x1039
load r63 r63                                                            ; 0x1039 -- restore sp
load r1 r63                                                             ; 0x103a -- pop return address
add r63 r63 r62                                                         ; 0x103b
jmp r1                                                                  ; 0x103c -- return
@system::_init_end$:                                                    ; 0x103d
@system::_merge_blocks:                                                 ; 0x103d
@system::_merge_blocks_start$:                                          ; 0x103d
sub r63 r63 r62                                                         ; 0x103d -- push return address
store r63 r0                                                            ; 0x103e
mov r1 r63                                                              ; 0x103f -- frame start
constant r2 0x0002                                                      ; 0x1040 -- allocate local storage
sub r63 r63 r2                                                          ; 0x1042
sub r63 r63 r62                                                         ; 0x1043 -- push frame start
store r63 r1                                                            ; 0x1044
constant r1 0x0000                                                      ; 0x1045
load r2 r63                                                             ; 0x1047 -- stack frame address
sub r2 r2 r62                                                           ; 0x1048 -- local address initial_block
store r2 r1                                                             ; 0x1049 -- var initial_block: * block = null;
constant r1 @system::blocks                                             ; 0x104a -- global address @system::blocks
load r1 r1                                                              ; 0x104c -- dereference @system::blocks
load r3 r63                                                             ; 0x104d -- stack frame address
constant r2 0x0002                                                      ; 0x104e -- local address block
sub r2 r3 r2                                                            ; 0x1050
store r2 r1                                                             ; 0x1051 -- var block: * block = blocks;
@system::_merge_blocks_for_1$:                                          ; 0x1052
load r3 r63                                                             ; 0x1052 -- stack frame address
constant r2 0x0002                                                      ; 0x1053 -- local address block
sub r2 r3 r2                                                            ; 0x1055
load r2 r2                                                              ; 0x1056 -- dereference block
constant r3 0x0000                                                      ; 0x1057 -- !(block)
neq r3 r3 r2                                                            ; 0x1059
constant r2 0x0000                                                      ; 0x105a -- !(!(block))
neq r2 r2 r3                                                            ; 0x105c
constant r1 0x0000                                                      ; 0x105d
neq r2 r2 r1                                                            ; 0x105f
constant r1 @system::_merge_blocks_for_end_2$                           ; 0x1060
jnz r2 r1                                                               ; 0x1062
load r4 r63                                                             ; 0x1063 -- stack frame address
constant r3 0x0002                                                      ; 0x1064 -- local address block
sub r3 r4 r3                                                            ; 0x1066
load r3 r3                                                              ; 0x1067 -- dereference block
load r3 r3                                                              ; 0x1068 -- deference (block).allocated
constant r4 0x0000                                                      ; 0x1069 -- !((block).allocated)
neq r4 r4 r3                                                            ; 0x106b
constant r3 0x0000                                                      ; 0x106c
neq r4 r4 r3                                                            ; 0x106e
constant r3 @system::_merge_blocks_else_3$                              ; 0x106f
jnz r4 r3                                                               ; 0x1071
load r5 r63                                                             ; 0x1072 -- stack frame address
sub r5 r5 r62                                                           ; 0x1073 -- local address initial_block
load r5 r5                                                              ; 0x1074 -- dereference initial_block
constant r6 0x0000                                                      ; 0x1075
neq r5 r5 r6                                                            ; 0x1077
constant r6 @system::_merge_blocks_else_5$                              ; 0x1078
jnz r5 r6                                                               ; 0x107a
load r7 r63                                                             ; 0x107b -- stack frame address
sub r7 r7 r62                                                           ; 0x107c -- local address initial_block
load r7 r7                                                              ; 0x107d -- dereference initial_block
constant r8 0x0002                                                      ; 0x107e -- (initial_block).next
add r7 r7 r8                                                            ; 0x1080
load r9 r63                                                             ; 0x1081 -- stack frame address
constant r8 0x0002                                                      ; 0x1082 -- local address block
sub r8 r9 r8                                                            ; 0x1084
load r8 r8                                                              ; 0x1085 -- dereference block
constant r9 0x0002                                                      ; 0x1086 -- (block).next
add r8 r8 r9                                                            ; 0x1088
load r8 r8                                                              ; 0x1089 -- deference (block).next
store r7 r8                                                             ; 0x108a -- (initial_block).next = (block).next;
load r7 r63                                                             ; 0x108b -- stack frame address
sub r7 r7 r62                                                           ; 0x108c -- local address initial_block
load r7 r7                                                              ; 0x108d -- dereference initial_block
constant r8 0x0001                                                      ; 0x108e -- (initial_block).size
add r7 r7 r8                                                            ; 0x1090
load r8 r63                                                             ; 0x1091 -- stack frame address
sub r8 r8 r62                                                           ; 0x1092 -- local address initial_block
load r8 r8                                                              ; 0x1093 -- dereference initial_block
constant r9 0x0001                                                      ; 0x1094 -- (initial_block).size
add r8 r8 r9                                                            ; 0x1096
load r8 r8                                                              ; 0x1097 -- deference (initial_block).size
constant r9 0x0003                                                      ; 0x1098 -- sizeof block
add r10 r8 r9                                                           ; 0x109a
load r9 r63                                                             ; 0x109b -- stack frame address
constant r8 0x0002                                                      ; 0x109c -- local address block
sub r8 r9 r8                                                            ; 0x109e
load r8 r8                                                              ; 0x109f -- dereference block
constant r9 0x0001                                                      ; 0x10a0 -- (block).size
add r8 r8 r9                                                            ; 0x10a2
load r8 r8                                                              ; 0x10a3 -- deference (block).size
add r9 r10 r8                                                           ; 0x10a4
store r7 r9                                                             ; 0x10a5 -- (initial_block).size = (((initial_block).size) + (sizeof block)) + ((block).size);
constant r6 @system::_merge_blocks_if_end_6$                            ; 0x10a6
jmp r6                                                                  ; 0x10a8
@system::_merge_blocks_else_5$:                                         ; 0x10a9
load r7 r63                                                             ; 0x10a9 -- stack frame address
sub r7 r7 r62                                                           ; 0x10aa -- local address initial_block
load r9 r63                                                             ; 0x10ab -- stack frame address
constant r8 0x0002                                                      ; 0x10ac -- local address block
sub r8 r9 r8                                                            ; 0x10ae
load r8 r8                                                              ; 0x10af -- dereference block
store r7 r8                                                             ; 0x10b0 -- initial_block = block;
@system::_merge_blocks_if_end_6$:                                       ; 0x10b1
constant r3 @system::_merge_blocks_if_end_4$                            ; 0x10b1
jmp r3                                                                  ; 0x10b3
@system::_merge_blocks_else_3$:                                         ; 0x10b4
load r5 r63                                                             ; 0x10b4 -- stack frame address
sub r5 r5 r62                                                           ; 0x10b5 -- local address initial_block
constant r6 0x0000                                                      ; 0x10b6
store r5 r6                                                             ; 0x10b8 -- initial_block = null;
@system::_merge_blocks_if_end_4$:                                       ; 0x10b9
load r4 r63                                                             ; 0x10b9 -- stack frame address
constant r3 0x0002                                                      ; 0x10ba -- local address block
sub r3 r4 r3                                                            ; 0x10bc
load r5 r63                                                             ; 0x10bd -- stack frame address
constant r4 0x0002                                                      ; 0x10be -- local address block
sub r4 r5 r4                                                            ; 0x10c0
load r4 r4                                                              ; 0x10c1 -- dereference block
constant r5 0x0002                                                      ; 0x10c2 -- (block).next
add r4 r4 r5                                                            ; 0x10c4
load r4 r4                                                              ; 0x10c5 -- deference (block).next
store r3 r4                                                             ; 0x10c6 -- block = (block).next;
constant r1 @system::_merge_blocks_for_1$                               ; 0x10c7
jmp r1                                                                  ; 0x10c9
@system::_merge_blocks_for_end_2$:                                      ; 0x10ca
@system::_merge_blocks_return$:                                         ; 0x10ca
load r63 r63                                                            ; 0x10ca -- restore sp
load r1 r63                                                             ; 0x10cb -- pop return address
add r63 r63 r62                                                         ; 0x10cc
jmp r1                                                                  ; 0x10cd -- return
@system::_merge_blocks_end$:                                            ; 0x10ce
@system::alloc:                                                         ; 0x10ce
@system::alloc_start$:                                                  ; 0x10ce
sub r63 r63 r62                                                         ; 0x10ce -- push return address
store r63 r0                                                            ; 0x10cf
mov r1 r63                                                              ; 0x10d0 -- frame start
constant r2 0x0004                                                      ; 0x10d1 -- allocate local storage
sub r63 r63 r2                                                          ; 0x10d3
sub r63 r63 r62                                                         ; 0x10d4 -- push frame start
store r63 r1                                                            ; 0x10d5
constant r1 @system::blocks                                             ; 0x10d6 -- global address @system::blocks
load r1 r1                                                              ; 0x10d8 -- dereference @system::blocks
constant r2 0x0000                                                      ; 0x10d9 -- !(blocks)
neq r2 r2 r1                                                            ; 0x10db
constant r1 0x0000                                                      ; 0x10dc
neq r2 r2 r1                                                            ; 0x10de
constant r1 @system::alloc_else_1$                                      ; 0x10df
jnz r2 r1                                                               ; 0x10e1
constant r3 @system::_init                                              ; 0x10e2 -- function address @system::_init
sub r63 r63 r62                                                         ; 0x10e4 -- push caller-save register
store r63 r1                                                            ; 0x10e5
sub r63 r63 r62                                                         ; 0x10e6 -- push caller-save register
store r63 r2                                                            ; 0x10e7
constant r0 @system::alloc_3$                                           ; 0x10e8 -- set up return address
jmp r3                                                                  ; 0x10ea
@system::alloc_3$:                                                      ; 0x10eb -- return address
mov r4 r0                                                               ; 0x10eb
load r2 r63                                                             ; 0x10ec -- pop caller-save register
add r63 r63 r62                                                         ; 0x10ed
load r1 r63                                                             ; 0x10ee -- pop caller-save register
add r63 r63 r62                                                         ; 0x10ef
constant r1 @system::alloc_if_end_2$                                    ; 0x10f0
jmp r1                                                                  ; 0x10f2
@system::alloc_else_1$:                                                 ; 0x10f3
@system::alloc_if_end_2$:                                               ; 0x10f3
constant r1 0x0000                                                      ; 0x10f3
load r2 r63                                                             ; 0x10f5 -- stack frame address
sub r2 r2 r62                                                           ; 0x10f6 -- local address free_block
store r2 r1                                                             ; 0x10f7 -- var free_block: * block = null;
constant r1 @system::blocks                                             ; 0x10f8 -- global address @system::blocks
load r1 r1                                                              ; 0x10fa -- dereference @system::blocks
load r3 r63                                                             ; 0x10fb -- stack frame address
constant r2 0x0002                                                      ; 0x10fc -- local address block
sub r2 r3 r2                                                            ; 0x10fe
store r2 r1                                                             ; 0x10ff -- var block: * block = blocks;
@system::alloc_for_4$:                                                  ; 0x1100
load r3 r63                                                             ; 0x1100 -- stack frame address
constant r2 0x0002                                                      ; 0x1101 -- local address block
sub r2 r3 r2                                                            ; 0x1103
load r2 r2                                                              ; 0x1104 -- dereference block
constant r3 0x0000                                                      ; 0x1105 -- !(block)
neq r3 r3 r2                                                            ; 0x1107
constant r2 0x0000                                                      ; 0x1108 -- !(!(block))
neq r2 r2 r3                                                            ; 0x110a
constant r1 0x0000                                                      ; 0x110b
neq r2 r2 r1                                                            ; 0x110d
constant r1 @system::alloc_for_end_5$                                   ; 0x110e
jnz r2 r1                                                               ; 0x1110
load r4 r63                                                             ; 0x1111 -- stack frame address
constant r3 0x0002                                                      ; 0x1112 -- local address block
sub r3 r4 r3                                                            ; 0x1114
load r3 r3                                                              ; 0x1115 -- dereference block
load r3 r3                                                              ; 0x1116 -- deference (block).allocated
constant r4 0x0000                                                      ; 0x1117 -- !((block).allocated)
neq r4 r4 r3                                                            ; 0x1119
constant r3 @system::alloc_and_end_6$                                   ; 0x111a
jz r4 r3                                                                ; 0x111c
load r6 r63                                                             ; 0x111d -- stack frame address
constant r5 0x0002                                                      ; 0x111e -- local address block
sub r5 r6 r5                                                            ; 0x1120
load r5 r5                                                              ; 0x1121 -- dereference block
constant r6 0x0001                                                      ; 0x1122 -- (block).size
add r5 r5 r6                                                            ; 0x1124
load r5 r5                                                              ; 0x1125 -- deference (block).size
load r7 r63                                                             ; 0x1126 -- stack frame address
constant r6 0x0001                                                      ; 0x1127 -- argument address size
add r6 r7 r6                                                            ; 0x1129
load r6 r6                                                              ; 0x112a -- dereference size
lt r7 r5 r6                                                             ; 0x112b
mov r4 r7                                                               ; 0x112c
@system::alloc_and_end_6$:                                              ; 0x112d -- end &&
constant r5 0x0000                                                      ; 0x112d
neq r4 r4 r5                                                            ; 0x112f
constant r5 @system::alloc_else_7$                                      ; 0x1130
jnz r4 r5                                                               ; 0x1132
load r6 r63                                                             ; 0x1133 -- stack frame address
sub r6 r6 r62                                                           ; 0x1134 -- local address free_block
load r8 r63                                                             ; 0x1135 -- stack frame address
constant r7 0x0002                                                      ; 0x1136 -- local address block
sub r7 r8 r7                                                            ; 0x1138
load r7 r7                                                              ; 0x1139 -- dereference block
store r6 r7                                                             ; 0x113a -- free_block = block;
constant r6 @system::alloc_for_end_5$                                   ; 0x113b
jmp r6                                                                  ; 0x113d
constant r5 @system::alloc_if_end_8$                                    ; 0x113e
jmp r5                                                                  ; 0x1140
@system::alloc_else_7$:                                                 ; 0x1141
@system::alloc_if_end_8$:                                               ; 0x1141
load r5 r63                                                             ; 0x1141 -- stack frame address
constant r4 0x0002                                                      ; 0x1142 -- local address block
sub r4 r5 r4                                                            ; 0x1144
load r6 r63                                                             ; 0x1145 -- stack frame address
constant r5 0x0002                                                      ; 0x1146 -- local address block
sub r5 r6 r5                                                            ; 0x1148
load r5 r5                                                              ; 0x1149 -- dereference block
constant r6 0x0002                                                      ; 0x114a -- (block).next
add r5 r5 r6                                                            ; 0x114c
load r5 r5                                                              ; 0x114d -- deference (block).next
store r4 r5                                                             ; 0x114e -- block = (block).next;
constant r1 @system::alloc_for_4$                                       ; 0x114f
jmp r1                                                                  ; 0x1151
@system::alloc_for_end_5$:                                              ; 0x1152
load r1 r63                                                             ; 0x1152 -- stack frame address
sub r1 r1 r62                                                           ; 0x1153 -- local address free_block
load r1 r1                                                              ; 0x1154 -- dereference free_block
constant r2 0x0000                                                      ; 0x1155 -- !(free_block)
neq r2 r2 r1                                                            ; 0x1157
constant r1 0x0000                                                      ; 0x1158
neq r2 r2 r1                                                            ; 0x115a
constant r1 @system::alloc_else_9$                                      ; 0x115b
jnz r2 r1                                                               ; 0x115d
constant r4 0x0000                                                      ; 0x115e
mov r0 r4                                                               ; 0x1160
constant r5 @system::alloc_return$                                      ; 0x1161
jmp r5                                                                  ; 0x1163
constant r1 @system::alloc_if_end_10$                                   ; 0x1164
jmp r1                                                                  ; 0x1166
@system::alloc_else_9$:                                                 ; 0x1167
@system::alloc_if_end_10$:                                              ; 0x1167
load r1 r63                                                             ; 0x1167 -- stack frame address
sub r1 r1 r62                                                           ; 0x1168 -- local address free_block
load r1 r1                                                              ; 0x1169 -- dereference free_block
constant r2 0x0001                                                      ; 0x116a
store r1 r2                                                             ; 0x116c -- (free_block).allocated = true;
load r1 r63                                                             ; 0x116d -- stack frame address
sub r1 r1 r62                                                           ; 0x116e -- local address free_block
load r1 r1                                                              ; 0x116f -- dereference free_block
constant r2 0x0003                                                      ; 0x1170 -- sizeof block
add r4 r1 r2                                                            ; 0x1172
load r2 r63                                                             ; 0x1173 -- stack frame address
constant r1 0x0003                                                      ; 0x1174 -- local address ptr
sub r1 r2 r1                                                            ; 0x1176
store r1 r4                                                             ; 0x1177 -- var ptr: * byte = <* byte>((<byte>(free_block)) + (sizeof block));
load r1 r63                                                             ; 0x1178 -- stack frame address
sub r1 r1 r62                                                           ; 0x1179 -- local address free_block
load r1 r1                                                              ; 0x117a -- dereference free_block
constant r2 0x0001                                                      ; 0x117b -- (free_block).size
add r1 r1 r2                                                            ; 0x117d
load r1 r1                                                              ; 0x117e -- deference (free_block).size
load r4 r63                                                             ; 0x117f -- stack frame address
constant r2 0x0001                                                      ; 0x1180 -- argument address size
add r2 r4 r2                                                            ; 0x1182
load r2 r2                                                              ; 0x1183 -- dereference size
sub r4 r1 r2                                                            ; 0x1184
constant r1 0x0003                                                      ; 0x1185 -- sizeof block
constant r2 @system::SPLIT_THRESHOLD                                    ; 0x1187 -- global address @system::SPLIT_THRESHOLD
load r2 r2                                                              ; 0x1189 -- dereference @system::SPLIT_THRESHOLD
add r5 r1 r2                                                            ; 0x118a
gt r1 r4 r5                                                             ; 0x118b
constant r2 0x0000                                                      ; 0x118c
neq r1 r1 r2                                                            ; 0x118e
constant r2 0x0000                                                      ; 0x118f
neq r1 r1 r2                                                            ; 0x1191
constant r2 @system::alloc_else_11$                                     ; 0x1192
jnz r1 r2                                                               ; 0x1194
load r5 r63                                                             ; 0x1195 -- stack frame address
constant r4 0x0003                                                      ; 0x1196 -- local address ptr
sub r4 r5 r4                                                            ; 0x1198
load r4 r4                                                              ; 0x1199 -- dereference ptr
load r6 r63                                                             ; 0x119a -- stack frame address
constant r5 0x0001                                                      ; 0x119b -- argument address size
add r5 r6 r5                                                            ; 0x119d
load r5 r5                                                              ; 0x119e -- dereference size
add r6 r4 r5                                                            ; 0x119f
load r5 r63                                                             ; 0x11a0 -- stack frame address
constant r4 0x0004                                                      ; 0x11a1 -- local address split_block
sub r4 r5 r4                                                            ; 0x11a3
store r4 r6                                                             ; 0x11a4 -- var split_block: * block = <* block>((<byte>(ptr)) + (size));
load r5 r63                                                             ; 0x11a5 -- stack frame address
constant r4 0x0004                                                      ; 0x11a6 -- local address split_block
sub r4 r5 r4                                                            ; 0x11a8
load r4 r4                                                              ; 0x11a9 -- dereference split_block
constant r5 0x0000                                                      ; 0x11aa
store r4 r5                                                             ; 0x11ac -- (split_block).allocated = false;
load r5 r63                                                             ; 0x11ad -- stack frame address
constant r4 0x0004                                                      ; 0x11ae -- local address split_block
sub r4 r5 r4                                                            ; 0x11b0
load r4 r4                                                              ; 0x11b1 -- dereference split_block
constant r5 0x0001                                                      ; 0x11b2 -- (split_block).size
add r4 r4 r5                                                            ; 0x11b4
load r5 r63                                                             ; 0x11b5 -- stack frame address
sub r5 r5 r62                                                           ; 0x11b6 -- local address free_block
load r5 r5                                                              ; 0x11b7 -- dereference free_block
constant r6 0x0001                                                      ; 0x11b8 -- (free_block).size
add r5 r5 r6                                                            ; 0x11ba
load r5 r5                                                              ; 0x11bb -- deference (free_block).size
load r7 r63                                                             ; 0x11bc -- stack frame address
constant r6 0x0001                                                      ; 0x11bd -- argument address size
add r6 r7 r6                                                            ; 0x11bf
load r6 r6                                                              ; 0x11c0 -- dereference size
sub r7 r5 r6                                                            ; 0x11c1
constant r5 0x0003                                                      ; 0x11c2 -- sizeof block
sub r6 r7 r5                                                            ; 0x11c4
store r4 r6                                                             ; 0x11c5 -- (split_block).size = (((free_block).size) - (size)) - (sizeof block);
load r5 r63                                                             ; 0x11c6 -- stack frame address
constant r4 0x0004                                                      ; 0x11c7 -- local address split_block
sub r4 r5 r4                                                            ; 0x11c9
load r4 r4                                                              ; 0x11ca -- dereference split_block
constant r5 0x0002                                                      ; 0x11cb -- (split_block).next
add r4 r4 r5                                                            ; 0x11cd
load r5 r63                                                             ; 0x11ce -- stack frame address
sub r5 r5 r62                                                           ; 0x11cf -- local address free_block
load r5 r5                                                              ; 0x11d0 -- dereference free_block
constant r6 0x0002                                                      ; 0x11d1 -- (free_block).next
add r5 r5 r6                                                            ; 0x11d3
load r5 r5                                                              ; 0x11d4 -- deference (free_block).next
store r4 r5                                                             ; 0x11d5 -- (split_block).next = (free_block).next;
load r4 r63                                                             ; 0x11d6 -- stack frame address
sub r4 r4 r62                                                           ; 0x11d7 -- local address free_block
load r4 r4                                                              ; 0x11d8 -- dereference free_block
constant r5 0x0001                                                      ; 0x11d9 -- (free_block).size
add r4 r4 r5                                                            ; 0x11db
load r6 r63                                                             ; 0x11dc -- stack frame address
constant r5 0x0001                                                      ; 0x11dd -- argument address size
add r5 r6 r5                                                            ; 0x11df
load r5 r5                                                              ; 0x11e0 -- dereference size
store r4 r5                                                             ; 0x11e1 -- (free_block).size = size;
load r4 r63                                                             ; 0x11e2 -- stack frame address
sub r4 r4 r62                                                           ; 0x11e3 -- local address free_block
load r4 r4                                                              ; 0x11e4 -- dereference free_block
constant r5 0x0002                                                      ; 0x11e5 -- (free_block).next
add r4 r4 r5                                                            ; 0x11e7
load r6 r63                                                             ; 0x11e8 -- stack frame address
constant r5 0x0004                                                      ; 0x11e9 -- local address split_block
sub r5 r6 r5                                                            ; 0x11eb
load r5 r5                                                              ; 0x11ec -- dereference split_block
store r4 r5                                                             ; 0x11ed -- (free_block).next = split_block;
constant r2 @system::alloc_if_end_12$                                   ; 0x11ee
jmp r2                                                                  ; 0x11f0
@system::alloc_else_11$:                                                ; 0x11f1
@system::alloc_if_end_12$:                                              ; 0x11f1
load r2 r63                                                             ; 0x11f1 -- stack frame address
constant r1 0x0003                                                      ; 0x11f2 -- local address ptr
sub r1 r2 r1                                                            ; 0x11f4
load r1 r1                                                              ; 0x11f5 -- dereference ptr
mov r0 r1                                                               ; 0x11f6
constant r2 @system::alloc_return$                                      ; 0x11f7
jmp r2                                                                  ; 0x11f9
@system::alloc_return$:                                                 ; 0x11fa
load r63 r63                                                            ; 0x11fa -- restore sp
load r1 r63                                                             ; 0x11fb -- pop return address
add r63 r63 r62                                                         ; 0x11fc
jmp r1                                                                  ; 0x11fd -- return
@system::alloc_end$:                                                    ; 0x11fe
@system::dealloc:                                                       ; 0x11fe
@system::dealloc_start$:                                                ; 0x11fe
sub r63 r63 r62                                                         ; 0x11fe -- push return address
store r63 r0                                                            ; 0x11ff
mov r1 r63                                                              ; 0x1200 -- frame start
sub r63 r63 r62                                                         ; 0x1201 -- allocate local storage
sub r63 r63 r62                                                         ; 0x1202 -- push frame start
store r63 r1                                                            ; 0x1203
load r2 r63                                                             ; 0x1204 -- stack frame address
constant r1 0x0001                                                      ; 0x1205 -- argument address pointer
add r1 r2 r1                                                            ; 0x1207
load r1 r1                                                              ; 0x1208 -- dereference pointer
constant r2 0x0000                                                      ; 0x1209 -- !(pointer)
neq r2 r2 r1                                                            ; 0x120b
constant r1 0x0000                                                      ; 0x120c
neq r2 r2 r1                                                            ; 0x120e
constant r1 @system::dealloc_else_1$                                    ; 0x120f
jnz r2 r1                                                               ; 0x1211
constant r3 0x0000                                                      ; 0x1212
mov r0 r3                                                               ; 0x1214
constant r4 @system::dealloc_return$                                    ; 0x1215
jmp r4                                                                  ; 0x1217
constant r1 @system::dealloc_if_end_2$                                  ; 0x1218
jmp r1                                                                  ; 0x121a
@system::dealloc_else_1$:                                               ; 0x121b
@system::dealloc_if_end_2$:                                             ; 0x121b
load r2 r63                                                             ; 0x121b -- stack frame address
constant r1 0x0001                                                      ; 0x121c -- argument address pointer
add r1 r2 r1                                                            ; 0x121e
load r1 r1                                                              ; 0x121f -- dereference pointer
constant r2 0x0003                                                      ; 0x1220 -- sizeof block
sub r3 r1 r2                                                            ; 0x1222
load r1 r63                                                             ; 0x1223 -- stack frame address
sub r1 r1 r62                                                           ; 0x1224 -- local address block
store r1 r3                                                             ; 0x1225 -- var block: * block = <* block>((<byte>(pointer)) - (sizeof block));
load r1 r63                                                             ; 0x1226 -- stack frame address
sub r1 r1 r62                                                           ; 0x1227 -- local address block
load r1 r1                                                              ; 0x1228 -- dereference block
constant r2 0x0000                                                      ; 0x1229
store r1 r2                                                             ; 0x122b -- (block).allocated = false;
constant r1 @system::_merge_blocks                                      ; 0x122c -- function address @system::_merge_blocks
constant r0 @system::dealloc_3$                                         ; 0x122e -- set up return address
jmp r1                                                                  ; 0x1230
@system::dealloc_3$:                                                    ; 0x1231 -- return address
mov r2 r0                                                               ; 0x1231
@system::dealloc_return$:                                               ; 0x1232
load r63 r63                                                            ; 0x1232 -- restore sp
load r1 r63                                                             ; 0x1233 -- pop return address
add r63 r63 r62                                                         ; 0x1234
jmp r1                                                                  ; 0x1235 -- return
@system::dealloc_end$:                                                  ; 0x1236