# Quinix CPU

The Quinix CPU is a 32-bit RISC processor.

## Registers

The QPU has 1 special-purpose register, `ip` (the instruction pointer),
along with 64 (for now -- but, we'll be careful to make this number configurable)
general-purpose "generic" registers, `r0`...`r63`.

## Instructions

In the following, `d` is a generic register that can be thought
of as the *destination* of the operation, while each `s` is a generic
register or special-purpose register that can be thought of as the *source*
or *sources* of the operation.

`halt`: halt execution

`int s`: trigger interrupt `s`

**Memory access and register manipulation**

`load d s`: load value at address `s` into `d`

`store d s`: store `s` into address `d`

`mov d s`: move value of `s` to `d`

`constant d`: load value at address `ip + 1` into `d`

> The expectation is that the next word in the binary is an "immediate"
> value.

**Arithmetic**

`add d s0 s1`: store `s0` plus `s1` into `d`

`sub d s0 s1`: store `s0` minus `s1` into `d`

`mul d s0 s1`: store `s0` times `s1` into `d`

`div d s0 s1`: store `s0` integer-divided by `s1` into `d`

`rem d s0 s1`: store the remainder of `s0` integer-divided by `s1` into `d`

> All integer arithmetic expressions are 32-bit, including multiplication.
> The QPU does not support floating point arithmetic.

**Bitwise operators**

`and d s0 s1`: store `s0` bitwise-and `s1` into `d`

`or d s0 s1`:  store `s0` bitwise-or `s1` into `d`

`not d s`:  store `s` bitwise-negated into `d`

`shl d s0 s1`: store `s0` left-shifted by `s1` bits into `d`

`shr d s0 s1`: store `s0` right-shifted (logical) by `s1` bits into `d`

**Comparison operators**

`eq d s0 s1`: if `s0` is equal to `s1`, store `0x1` into `d`; otherwise, store `0x0`

`neq d s0 s1`: if `s0` is not equal to `s1`, store `0x1` into `d`; otherwise, store `0x0`

`lt d s s`: if `s0` is less than `s1`, store `0x1` into `d`; otherwise, store `0x0`

`gt d s s`: if `s0` is greater than `s1`, store `0x1` into `d`; otherwise, store `0x0`

**Branching operators**

`jmp s`: jump to the address `s`

`jz s0 s1`: if `s0` is `0x0`, jump to the address `s1`

`jnz s0 s1`: if `s0` is not `0x0`, jump to the address `s1`

> the implicit destination of the "jump" instructions is `ip`.

`nop`: no-op

Instructions are always encoded as 32-bit words. The first 8 bits (or *octet*) represent
the instruction itself (e.g. `add`, `sub`, and so on). The values of each instruction
can be found [here](../src/vm/instructions.ts#L6).

The second octet encodes the destination register, if the operation uses one --
otherwise, they should equal `0x00`, and will be ignored.

Likewise, the third and fourth octets encode the source register or registers, if needed --
again, if the operation does not require them, they should equal `0x00`, and will be ignored.

### Example: simple program

The following program copies the memory located at the address stored in `r0` (the
"source buffer" to the address stored in `r1` (the "destination buffer"). It assumes
that the source buffer is zero-terminated.

(In the following, the left column is meant to be the *binary* contents of the file,
and the rest is just line-by-line commentary).

```
    0x02020000      ; load r2 r0        -- read a byte from source.
    0x03010200      ; store r1 r2       -- write a byte to destination.

    0x05030000      ; constant r3       -- 1 for incrementing.
    0x00000001      ; 0x1               -- immediate value.
    0x06000003      ; add r0 r0 r3      -- increment the source pointer.
    0x06010103      ; add r1 r1 r3      -- increment the destination pointer.

    0x05040000      ; constant r4       -- the address of the beginning of the loop.
    0x00000000      ; 0x0               -- immediate value.
    0x10020400      ; jnz r2 r4         -- if we haven't found the 0x0 terminator, keep copying.

    0x00000000      ; halt              -- otherwise, we're done.
```

## Interrupts


## Peripherals

All peripheral interaction is via DMA. Peripherals map a contiguous
region of physical memory. The first part is a number of "io" bytes,
which trigger `notify` on the peripheral when written. The second part
is "shared" memory, does not trigger `notify`.

### Example: output

The debug output peripheral maps 1 "control" io byte, 1 "size" shared byte,
and N "buffer" shared bytes. When 0x1 is written to control, first control
is set to 0x2, meaning "pending". Then size bytes from the buffer
(starting from 0) are written to the debug output interface (that is, `console.log`).
When output is complete, control is assigned 0x0. If an error occurs, control
is assigned -1 (0xffffffff).

The amount of time it takes to write output is undefined.

```qasm
@main:
    ; Assuming 0x200 is the address of the peripheral's mapped memory...
    ; Put 3 in "size"
    constant r0 0x201
    constant r1 0x3
    store r0 r1

    ; Put Hi! in "buffer".
    constant r0 0x202
    constant r1 'H'
    store r0 r1

    constant r0 0x202
    constant r1 'i'
    store r0 r1

    constant r0 0x203
    constant r1 '!'
    store r0 r1

    ; Put 0x1 in "control".
    constant r0 0x200
    constant r1 0x201
    store r0 r1

@wait:
    ; Wait for the write to complete.
    constant r0 0x0
    int r0

    constant r1 0x200
    load r1 r1
    jnz r1 @wait

@exit:
    ; Write complete.
    halt
```

The debug input peripheral works in a similar way. It maps 1 "control" io byte, 1 "size" shared byte,
and N "buffer" shared bytes. When 0x1 is written to "control", first `0x2`
"pending" is written to control.  Then some number of bytes are read from
the debug input (stdin) and written to the "buffer". If all bytes
are read (that is, if the last byte read was `'\n'`), then control is assigned
`0x0`.

## Boot sequence

* Zero memory (disables MMU)
* Map peripherals
* Map interrupts
* Load program at the default program address (currently `0x1000`).
* Start execution the default program address
