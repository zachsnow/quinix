# Quinix

Quinix is an educational project implementing a complete virtual computing stack: a 32-bit RISC virtual machine, an assembly language, and a C-like high-level language. It is intended to additionally include an operating system for
the VM written in the high-level language.

## Architecture

```
QLL Source (.qll)
    ↓ qllc
QASM Assembly (.qasm)
    ↓ qasm
Binary (.qbin)
    ↓ qvm
Execution
```

## Build & Test

```bash
bun install       # Install dependencies
./build.sh        # Generate parsers, type check, build lib/kernel
bun test          # Run test suite
```

## CLI Tools

All tools are in `bin/` and run via bun:

```bash
bun run bin/qllc.ts <file.qll>     # Compile QLL to QASM
bun run bin/qasm.ts <file.qasm>    # Assemble QASM to binary
bun run bin/qvm.ts <file.qbin>     # Execute binary
bun run bin/qrun.ts <file.qll>     # Compile, assemble, and run
```

## Project Structure

- `src/vm/` - Virtual machine (QPU with 64 registers, MMU, peripherals)
- `src/assembly/` - QASM parser and assembler
- `src/lowlevel/` - QLL compiler (parser, typechecker, codegen)
- `src/lib/` - Shared utilities
- `lib/` - QLL standard library (std.qll, etc.)
- `kernel/` - OS kernel (in QLL)
- `examples/` - Example programs in QASM and QLL
- `docs/` - Architecture documentation

## Languages

### QASM (Assembly)

```asm
; Comments use semicolons
data @hello 'Hello world!\n'
constant r0 @hello
load r1 r1
@loop:
  load r3 r0
  store r1 r3
  add r0 r0 r2
jnz r3 @loop
halt
```

Instructions: `halt`, `int`, `load`, `store`, `mov`, `constant`, `add`, `sub`, `mul`, `div`, `mod`, `and`, `or`, `not`, `eq`, `neq`, `lt`, `gt`, `jmp`, `jz`, `jnz`, `nop`, `wait`

Registers: `r0`-`r63`, `ip`

### QLL (High-level)

```c
// C-like syntax
function main(): byte {
  var buffer: byte[0x100];
  std::console::print('Say something! ');
  if (!std::console::input(buffer)) {
    return -1;
  }
  std::console::print(buffer);
  return 0;
}
```

Types: `byte`, `bool`, pointers (`*T`), arrays (`T[]`, `T[n]`), structs, function types, generics (`<T>`)

Keywords: `function`, `var`, `global`, `struct`, `type`, `namespace`, `using`, `if`, `else`, `while`, `for`, `return`, `break`, `unsafe`, `new`, `delete`, `len`, `capacity`, `sizeof`

## Parser Generation

Parsers are generated from PEG grammars using [peggy](https://peggyjs.org/) with the ts-pegjs plugin:

- `src/assembly/parser.pegjs` → QASM parser
- `src/lowlevel/*.pegjs` → QLL parser (layered: base → types → expressions → statements)

Regenerate with `./build.sh`.

## Related Projects

- `../quinix-site` - Project website with documentation series
- `../quinix-vscode` - VS Code extension for QASM/QLL syntax highlighting
