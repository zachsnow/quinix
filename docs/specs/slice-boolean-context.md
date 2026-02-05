# Spec: Type Conversions and Boolean Context

## Overview

QLL has three categories of type conversion:

1. **Assignment Conversions** - Implicit conversions when assigning or passing arguments
2. **Contextual Conversions** - Implicit extraction of a testable value in specific contexts
3. **Explicit Casts** - Programmer-specified conversions via `<type>expr`

This spec addresses category 2, specifically boolean context.

## Current Assignment Conversions

These are handled by `Type.isUnifiableWith()` and `Compiler.emitConversion()`:

| Source | Destination | Mechanism |
|--------|-------------|-----------|
| `T[N]` | `T[]` | Create slice descriptor with compile-time length |
| `*T[N]` | `T[]` | Create slice descriptor from pointer |
| `T[]` | `slice-struct` | Structural compatibility (same layout) |
| `slice-struct` | `T[]` | Structural compatibility (same layout) |

## Contextual Conversions

### Boolean Context

A type can be used in boolean context (`!`, `&&`, `||`, `if`, `while`, `for`, `?:`) if it has a meaningful null/zero state.

**Current** (`Type.integral`):
- `byte`, `bool` - test if zero
- `*T` - test if null
- `() => T` - test if null

**Proposed** (`Type.booleanTestable`):
- All of the above, plus:
- `T[]` - test if pointer component is null

### The Pattern

For single-word types, boolean testing is straightforward - compare to zero.

For compound types, we need to identify a **presence component** - the field that determines whether the value is "present" or "empty":

| Type | Presence Component | Offset |
|------|-------------------|--------|
| `T[]` | `pointer: *T` | 0 |

This pattern could extend to future types:
- `optional<T>` → test `present: bool` field
- `result<T, E>` → test `ok: bool` field

## Implementation

### Type System (`src/lowlevel/types.ts`)

Add to `Type` base class:

```typescript
/**
 * Returns info for boolean context testing, or null if not testable.
 * For compound types, returns the offset and type of the presence component.
 */
public booleanTest(): { offset: number; size: number } | null {
  if (this.integral) {
    return { offset: 0, size: this.size };
  }
  return null;
}
```

Override in `SliceType`:

```typescript
public booleanTest(): { offset: number; size: number } | null {
  return { offset: 0, size: 1 };  // Test pointer field (first word)
}
```

### Type Checker (`src/lowlevel/expressions.ts`, `src/lowlevel/statements.ts`)

Replace `type.integral` checks with `type.booleanTest() !== null` in:
- `UnaryExpression.typecheck()` for `!` (~line 1722)
- `BinaryExpression.typecheck()` for `&&`, `||` (~line 1435)
- `ConditionalExpression.typecheck()` (~line 2729)
- `IfStatement.typecheck()` (~line 353)
- `ForStatement.typecheck()` (~line 450)
- `WhileStatement.typecheck()` (~line 533)

### Code Generation (`src/lowlevel/compiler.ts`)

When emitting boolean tests, use `booleanTest()` to determine what to load:

```typescript
function emitBooleanTest(compiler: Compiler, expr: Expression, type: Type): Register {
  const test = type.booleanTest();
  if (!test) throw new Error('Type not boolean testable');

  const reg = expr.compile(compiler);

  if (test.offset > 0 || test.size < type.size) {
    // Compound type: load presence component
    if (test.offset > 0) {
      compiler.emitIncrement(reg, test.offset);
    }
    compiler.emit(Operation.LOAD, reg, reg);
  }

  return reg;
}
```

## Semantics

- `!slice` → `slice.pointer == null`
- `slice && x` → short-circuit if `slice.pointer == null`
- `slice || x` → short-circuit if `slice.pointer != null`
- `if (slice)` → branch if `slice.pointer != null`
- `slice ? a : b` → `a` if `slice.pointer != null`, else `b`

Note: An empty slice (`len == 0`) with non-null pointer is **truthy**.
This matches the semantics of empty arrays in C (non-null pointer, zero elements).

## Test Cases

```c
function test_slice_boolean(): byte {
  var arr: byte[] = new byte[10];
  if (!arr) { return 1; }      // Should not enter (non-null)

  delete arr;
  if (!arr) { return 0; }      // Should enter (null after delete)

  return 2;
}

function test_empty_slice(): byte {
  var arr: byte[] = new byte[0];  // Empty but allocated
  if (!arr) { return 1; }         // Should NOT enter (pointer is non-null)
  if (len arr != 0) { return 2; }
  return 0;
}

function test_logical_ops(): byte {
  var a: byte[] = new byte[5];
  var b: byte[] = null;

  if (a && b) { return 1; }   // Should not enter (b is null)
  if (a || b) { return 0; }   // Should enter (a is non-null)
  return 2;
}
```

## Relationship to Other Conversions

This is distinct from assignment conversion:
- Assignment: `T[N] → T[]` creates a new slice descriptor
- Boolean: `T[] → bool` extracts and tests the pointer component

The value remains a slice; we just extract information from it for the test.
No new slice descriptor is created.
