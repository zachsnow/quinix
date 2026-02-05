# Spec: Slice Types in Boolean Context

## Problem

Slice types (`T[]`) cannot be used in boolean context (with `!`, `&&`, `||`, `if`, `while`, etc.). The type checker requires "integral" types, which includes pointers and builtins but not slices.

```c
var arr: byte[] = new byte[10];
if (!arr) { ... }  // ERROR: expected integral type, actual byte[]
```

**Workaround**: `if (!(&arr[0])) { ... }` - ugly and crashes on null slice.

## Solution

Allow slices in boolean context by extracting and testing the underlying pointer.

### Type Checker Changes

**File**: `src/lowlevel/types.ts`

Add a new property to `Type`:

```typescript
public get booleanTestable(): boolean {
  const cType = this.resolve();
  return cType.integral || cType instanceof SliceType;
}
```

**File**: `src/lowlevel/expressions.ts` and `src/lowlevel/statements.ts`

Replace checks for `.integral` with `.booleanTestable` in:
- `UnaryExpression.typecheck()` for `!` operator (~line 1722)
- `BinaryExpression.typecheck()` for `&&` and `||` operators (~line 1435)
- `ConditionalExpression.typecheck()` (~line 2729)
- `IfStatement.typecheck()` (~line 353)
- `ForStatement.typecheck()` (~line 450)
- `WhileStatement.typecheck()` (~line 533)

### Code Generation Changes

**File**: `src/lowlevel/compiler.ts`

When compiling a boolean test on a slice, extract the pointer field (offset 0) and test that:

```typescript
// In UnaryExpression.compile() for '!':
if (type instanceof SliceType) {
  // Slice is 3 words: [pointer, length, capacity]
  // Load just the pointer (first word) and test it
  this.expression.compile(compiler);  // Push slice address
  compiler.emit(Operation.LOAD, ...);  // Load pointer field
  compiler.emit(Operation.NOT, ...);   // Negate
}
```

Similarly for `&&`, `||`, and conditional jumps - extract pointer before testing.

### Runtime Semantics

- `!slice` returns `true` if `slice.pointer == null`
- `slice && x` short-circuits if `slice.pointer == null`
- `slice || x` short-circuits if `slice.pointer != null`
- `if (slice)` branches if `slice.pointer != null`

### Test Cases

```c
function test_slice_negation(): byte {
  var arr: byte[] = new byte[10];
  if (!arr) { return 1; }  // Should not enter

  delete arr;
  if (!arr) { return 0; }  // Should enter (null after delete)

  return 2;
}

function test_slice_and(): byte {
  var a: byte[] = new byte[5];
  var b: byte[] = new byte[5];

  if (a && b) { return 0; }  // Both non-null
  return 1;
}
```

## Notes

- This is analogous to how pointers work in boolean context
- No runtime overhead for the common case (just load first word of slice struct)
- Consistent with C/C++ where arrays decay to pointers in boolean context
