# Quinix Assembler

The Quinix assembler, QASM, takes `.qasm` files and generates binary images (`.qbin` files)
suitable for running on the [Quinix virtual machine.](./qvm.md)

Other than the "normal" instructions (`add r1 r2 r3` and so on), the assembler
supports a couple of additional features:

* Single-line comments.
* `data` directives allow embedding literal data in the generated binary, and
naming the address of the data with a label.
* `constant` directives allow specifying a literal or label
* `@label:` directives allow labelling a particular address with a particular label.

## Comments

Comments begin with `;` and continue to the end of the line:

```qasm
; This is a comment.
add r1 r2 r3 ; And so is this.
```

## Instructions

Instructions are as specified in the CPU documentation; examples:

```qasm
add r1 r2 r3
jmp r1
halt
```

## Data

Examples:

```qasm
data @label 0x1
data @label 0x1 0x2 0x3
data @label 'Some string'
data @label @someLabel
```

Numeric literals ("immediates") can be decimal, hexadecimal (when prepended with `0x`),
or binary (when prepended with `0b`). Examples include `42`, `-23`, `0xdeadbeef`, and `0b1101`.
All immediates must fit within 32 bits.

String literals are single-quoted and support a few escapes: `\'` represents a literal single quote;
`\n` represents a literal newline; `\\` represets a literal `\`.  String literals are assembled
as a single byte encoding the string's length in code points, followed by the code points comprising
the string. They are **not** zero-terminated.

## Constants

The `constant` directive takes its data argument on the same line;
it can be an immediate value or a label. When it is a label, its value
is the address at which the label is found in the assembled binary.

```qasm
constant r0 0x1
constant r0 @label
```

## Labels

Label directives introduce a new label whose value is the address
at which the label appears.

```qasm
constant r0 0x0

@loop:
add r0 r0 r1
constant r2 @loop
jnz r0 r2

halt
```
