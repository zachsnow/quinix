# Floating Point Support

This document describes what it would take to add 32-bit floating point support to Quinix.

## Overview

Floating point values would be represented as IEEE 754 single-precision floats, stored in the same 32-bit words used for integers. The approach is to treat floats as an alternate interpretation of a `byte` value, similar to how C allows reinterpreting memory.

## QVM Changes

### New Instructions

Add floating point arithmetic operations:

| Opcode | Mnemonic | Description |
|--------|----------|-------------|
| FADD | `fadd d s0 s1` | `d = s0 + s1` (float) |
| FSUB | `fsub d s0 s1` | `d = s0 - s1` (float) |
| FMUL | `fmul d s0 s1` | `d = s0 * s1` (float) |
| FDIV | `fdiv d s0 s1` | `d = s0 / s1` (float) |

Add floating point comparison operations:

| Opcode | Mnemonic | Description |
|--------|----------|-------------|
| FEQ | `feq d s0 s1` | `d = (s0 == s1)` (float comparison) |
| FLT | `flt d s0 s1` | `d = (s0 < s1)` (float comparison) |
| FGT | `fgt d s0 s1` | `d = (s0 > s1)` (float comparison) |

Add conversion operations:

| Opcode | Mnemonic | Description |
|--------|----------|-------------|
| ITOF | `itof d s` | Convert signed integer to float |
| UTOF | `utof d s` | Convert unsigned integer to float |
| FTOI | `ftoi d s` | Convert float to signed integer (truncate) |

### Implementation

In `src/vm/instructions.ts`, extend the `Operation` enum:

```typescript
enum Operation {
  // ... existing ops ...

  FADD,
  FSUB,
  FMUL,
  FDIV,

  FEQ,
  FLT,
  FGT,

  ITOF,
  UTOF,
  FTOI,
}
```

In `src/vm/vm.ts`, add instruction handlers. JavaScript's `DataView` can reinterpret between integer and float representations:

```typescript
// Helper functions for float reinterpretation
const buffer = new ArrayBuffer(4);
const intView = new Uint32Array(buffer);
const floatView = new Float32Array(buffer);

function intToFloat(i: number): number {
  intView[0] = i >>> 0;
  return floatView[0];
}

function floatToInt(f: number): number {
  floatView[0] = f;
  return intView[0];
}

// In the instruction switch:
case Operation.FADD: {
  const a = intToFloat(registers[decoded.sr0!]);
  const b = intToFloat(registers[decoded.sr1!]);
  registers[decoded.dr!] = floatToInt(a + b);
  break;
}

case Operation.ITOF: {
  const i = registers[decoded.sr0!] | 0;  // signed
  registers[decoded.dr!] = floatToInt(i);
  break;
}

case Operation.FTOI: {
  const f = intToFloat(registers[decoded.sr0!]);
  registers[decoded.dr!] = Math.trunc(f) >>> 0;
  break;
}
```

### Design Decisions

**No separate float registers**: Floats use the same r0-r63 registers as integers. This keeps the architecture simple and matches the philosophy that a float is just a different interpretation of a 32-bit word.

**No FMOD**: Floating point modulo is rarely needed and can be computed from other operations if required.

**No FNEQ**: Can be computed as `!feq`.

**No FLE/FGE**: Can be computed from FLT/FGT/FEQ.

**Truncation for FTOI**: Matches C behavior. Rounding modes could be added later if needed.

## QASM Changes

### New Instructions

The assembler needs to recognize the new mnemonics:

```asm
fadd r0 r1 r2    ; r0 = float(r1) + float(r2)
fsub r0 r1 r2
fmul r0 r1 r2
fdiv r0 r1 r2

feq r0 r1 r2     ; r0 = 1 if float(r1) == float(r2), else 0
flt r0 r1 r2
fgt r0 r1 r2

itof r0 r1       ; r0 = float(signed(r1))
utof r0 r1       ; r0 = float(unsigned(r1))
ftoi r0 r1       ; r0 = int(truncate(float(r1)))
```

### Float Literals

Add float literal syntax to data directives:

```asm
data @pi 3.14159f
data @e 2.71828f
data @neg -1.5f
data @sci 1.23e-4f
```

The `f` suffix distinguishes float literals from integer literals. The assembler converts to IEEE 754 representation at assembly time.

### Implementation

In `src/assembly/parser.pegjs`, add float literal parsing:

```pegjs
FloatLiteral
  = sign:"-"? whole:Integer "." frac:Integer exp:Exponent? "f"
  { return parseFloat((sign || '') + whole + '.' + frac + (exp || '')); }

Exponent
  = [eE] sign:[+-]? digits:Integer
  { return 'e' + (sign || '') + digits; }
```

In the assembler, convert float literals to their IEEE 754 bit representation using the same `floatToInt` helper.

## QLL Changes

### New Type

Add `float` as a primitive type:

| Type | Size | Description |
|------|------|-------------|
| `float` | 1 word | IEEE 754 single-precision float |

### Float Literals

```qll
var pi: float = 3.14159;
var e: float = 2.71828;
var neg: float = -1.5;
var sci: float = 1.23e-4;
```

Float literals are distinguished by the presence of a decimal point or exponent. Integer literals assigned to float variables are implicitly converted.

### Operators

Float arithmetic uses the same operators as integers. The compiler chooses integer or float instructions based on operand types:

```qll
var a: float = 1.5;
var b: float = 2.5;
var c: float = a + b;    // emits FADD
var d: float = a * b;    // emits FMUL
var e: bool = a < b;     // emits FLT
```

Mixed operations require explicit conversion:

```qll
var i: byte = 10;
var f: float = 2.5;
// var bad = i + f;     // ERROR: type mismatch
var ok = <float>i + f;  // OK: explicit conversion
```

### Conversions

**Explicit conversions** using cast syntax:

```qll
var i: byte = 42;
var f: float = <float>i;   // emits ITOF (signed)

var f2: float = 3.7;
var i2: byte = <byte>f2;   // emits FTOI, truncates to 3
```

**No implicit conversions** between float and byte to avoid silent precision loss.

**Reinterpret cast** to access raw bits:

```qll
var f: float = 1.0;
var bits: byte = <unsafe byte>f;  // raw IEEE 754 bits: 0x3f800000
```

### Type Checking

In `src/lowlevel/typechecker.ts`:

- Add `float` to the set of primitive types
- For binary operators (+, -, *, /, <, >, ==, !=):
  - If both operands are `float`, result is `float` (comparisons return `bool`)
  - If operands are mixed `byte`/`float`, report type error
- For casts:
  - `<float>byte` is valid (emits ITOF)
  - `<byte>float` is valid (emits FTOI)
  - `<unsafe byte>float` and `<unsafe float>byte` reinterpret bits

### Code Generation

In `src/lowlevel/compiler.ts`:

```typescript
// When compiling binary operations, check if operands are float
private compileBinaryOp(op: BinaryOp, left: Type, right: Type): Operation {
  if (left.isFloat() && right.isFloat()) {
    switch (op) {
      case '+': return Operation.FADD;
      case '-': return Operation.FSUB;
      case '*': return Operation.FMUL;
      case '/': return Operation.FDIV;
      case '<': return Operation.FLT;
      case '>': return Operation.FGT;
      case '==': return Operation.FEQ;
      // ...
    }
  }
  // ... existing integer cases
}
```

### Parser Changes

In `src/lowlevel/expressions-parser.pegjs`, add float literal:

```pegjs
FloatLiteral
  = sign:"-"? whole:Integer "." frac:[0-9]+ exp:Exponent?
  { return new FloatLiteral(parseFloat(text())); }
  / sign:"-"? whole:Integer exp:Exponent
  { return new FloatLiteral(parseFloat(text())); }

Exponent = [eE] [+-]? [0-9]+
```

## Standard Library

Add float utilities in `shared/std.qll`:

```qll
namespace std::float {
  // Constants
  .constant global PI: float = 3.14159265;
  .constant global E: float = 2.71828182;
  .constant global NAN: float = <unsafe float>0x7fc00000;
  .constant global INF: float = <unsafe float>0x7f800000;

  // Predicates
  function isnan(f: float): bool {
    var bits: byte = <unsafe byte>f;
    // NaN: exponent all 1s, mantissa non-zero
    return (bits & 0x7f800000) == 0x7f800000 && (bits & 0x007fffff) != 0;
  }

  function isinf(f: float): bool {
    var bits: byte = <unsafe byte>f;
    // Inf: exponent all 1s, mantissa zero
    return (bits & 0x7fffffff) == 0x7f800000;
  }

  // Formatting
  function ftoa(f: float, buffer: string, precision: byte): bool {
    // Implementation: extract sign, exponent, mantissa
    // Format as decimal string
    // ...
  }
}
```

Extend `std::fmt` with float support:

```qll
namespace fmt {
  namespace fmt_type {
    .constant global F: fmt_type = 5;  // float
  }

  function ff(f: float): fmt {
    return fmt {
      fmt_type = fmt_type::F,
      n = <unsafe byte>f,  // store raw bits in n field
    };
  }

  // In print(), add case for fmt_type::F
}
```

## Testing

### QVM Tests

```typescript
test('fadd', () => {
  // 1.5 + 2.5 = 4.0
  const a = floatToInt(1.5);
  const b = floatToInt(2.5);
  // ... run fadd ...
  expect(intToFloat(result)).toBe(4.0);
});

test('ftoi truncates', () => {
  const f = floatToInt(3.7);
  // ... run ftoi ...
  expect(result).toBe(3);
});

test('ftoi negative', () => {
  const f = floatToInt(-3.7);
  // ... run ftoi ...
  expect(result | 0).toBe(-3);  // signed interpretation
});
```

### QLL Tests

```qll
function test_float_arithmetic(): byte {
  var a: float = 1.5;
  var b: float = 2.5;
  if (a + b != 4.0) { return 1; }
  if (a * b != 3.75) { return 2; }
  return 0;
}

function test_float_comparison(): byte {
  var a: float = 1.5;
  var b: float = 2.5;
  if (!(a < b)) { return 1; }
  if (a > b) { return 2; }
  if (a == b) { return 3; }
  return 0;
}

function test_conversions(): byte {
  var i: byte = 42;
  var f: float = <float>i;
  var i2: byte = <byte>f;
  if (i2 != 42) { return 1; }

  var f2: float = 3.7;
  var i3: byte = <byte>f2;
  if (i3 != 3) { return 2; }  // truncated

  return 0;
}
```

## Work Estimate

| Component | Changes |
|-----------|---------|
| QVM | Add 10 new operations, ~50 lines |
| QASM parser | Float literal syntax, ~20 lines |
| QASM assembler | Float-to-bits conversion, ~10 lines |
| QLL parser | Float literal syntax, ~30 lines |
| QLL typechecker | Float type handling, ~100 lines |
| QLL compiler | Float codegen, ~50 lines |
| Standard library | Float utilities, ~100 lines |
| Tests | Comprehensive coverage, ~200 lines |

## Future Enhancements

- **64-bit doubles**: Would require 2-word storage and more complex register handling
- **Math functions**: sin, cos, sqrt, etc. (could be implemented in QLL using Taylor series, or as VM intrinsics)
- **Rounding modes**: Currently only truncation is supported for float-to-int
- **Denormals and special values**: Proper handling of denormalized numbers, signaling NaN, etc.
