; @expect: 1
; itof treats 0xFFFFFFFF as -1 (signed), utof treats it as 4294967295 (unsigned).
; itof(-1) -> -1.0 -> ftoi -> 0xFFFFFFFF
; Verify itof roundtrips correctly for a negative value.
constant r1 0xFFFFFFFF
itof r2 r1           ; -1 -> -1.0
ftoi r3 r2           ; -1.0 -> 0xFFFFFFFF
eq r0 r1 r3          ; should match
halt
