# Slices Design Plan

## Current State

**Sized arrays `T[N]`:**
- Memory layout: `[capacity][length][elem0][elem1]...[elemN-1]`
- Size: N + 2 words
- Stack-allocated when declared as local variable
- `capacity` is always N, `length` can be less (for partially-filled arrays)

**Unsized arrays `T[]`:**
- Memory layout: `[pointer]`
- Size: 1 word
- Just a pointer to a sized array (points to the capacity word)
- `new T[N]` returns `T[]`

**Problems with current design:**
1. No way to take a sub-range of an array without copying
2. `T[]` is just a raw pointer - no bounds checking possible without chasing pointer
3. Confusing that `T[]` and `T[N]` have very different semantics

## Proposed Design

### Arrays `T[N]`

Fixed-size inline storage. No changes from current behavior.

```
Memory layout: [capacity][length][elem0][elem1]...[elemN-1]
Size: N + 2 words
```

- `capacity` = N (compile-time constant)
- `length` = current number of valid elements (runtime, <= N)
- Data is inline, immediately after the header

### Slices `T[]`

A slice is a view into contiguous memory. Three words.

```
Memory layout: [pointer][length][capacity]
Size: 3 words
```

- `pointer` = address of first element (not the header, the actual data)
- `length` = number of accessible elements
- `capacity` = number of elements from pointer to end of backing storage

### Operations

| Operation | Arrays `T[N]` | Slices `T[]` |
|-----------|---------------|--------------|
| `len x` | returns length field | returns length field |
| `capacity x` | returns N | returns capacity field |
| `x[i]` | bounds check, access elem | bounds check, access via pointer |
| `x[lo:hi]` | creates slice | creates slice |
| `len x = n` | sets length | sets length |

### Conversions

**Array to slice (implicit):**
When a `T[N]` is used where `T[]` is expected, create a slice:
- pointer = address of elem0
- length = array's length
- capacity = N

**Slice to array: not allowed** (size unknown at compile time)

### Heap Allocation

`new T[N]` allocates on heap and returns `T[]`:
- Allocates: `[capacity][length][elem0]...[elemN-1]` (same as stack array)
- Returns slice: pointer to elem0, length=0, capacity=N

### Slice Expression `x[lo:hi]`

Creates a new slice from array or slice:
- `lo` defaults to 0
- `hi` defaults to `len x`
- Result: pointer = &x[lo], length = hi - lo, capacity = (capacity x) - lo

Bounds: 0 <= lo <= hi <= capacity x

## Implementation Steps

### Phase 1: Add SliceType

1. Create `SliceType` class in `types.ts`
   - `size` = 3
   - `index()` returns element type
   - Unifiable only with slices of same element type

2. Change `ArrayType` parsing
   - `T[]` now creates `SliceType`, not `ArrayType` with undefined length
   - `T[N]` still creates `ArrayType`

3. Update type unification
   - `T[N]` implicitly converts to `T[]`
   - Add `isConvertibleTo` check for array-to-slice

### Phase 2: Update Codegen

4. Update `IndexExpression` compilation
   - For arrays: skip header (2 words), access inline data
   - For slices: load pointer, then access via pointer

5. Update `len` and `capacity` expressions
   - For arrays: read from header
   - For slices: read from slice struct

6. Update array-to-slice conversion codegen
   - Emit code to construct 3-word slice from array

### Phase 3: Add Slice Expression

7. Add `SliceExpression` class in `expressions.ts`
   - Typecheck: input must be array or slice, bounds must be numeric
   - Returns `SliceType`

8. Add parser grammar for `x[lo:hi]`
   - `x[:]` = full slice
   - `x[lo:]` = from lo to end
   - `x[:hi]` = from start to hi
   - `x[lo:hi]` = from lo to hi

9. Wire up `SuffixExpression.build` to create `SliceExpression`

### Phase 4: Update Standard Library

10. Update `std::vector` to use new slice semantics
11. Update any code using `T[]` as raw pointer

## Code Changes Summary

**types.ts:**
- Add `SliceType` class
- Modify `ArrayType` to always require length
- Update parser type creation

**expressions.ts:**
- Add `SliceExpression` class
- Update `IndexExpression.compile` for slice indirection
- Update `SuffixExpression.build` for slice case

**expressions-parser.pegjs:**
- Add slice syntax `[lo:hi]`

**compiler.ts:**
- Add array-to-slice conversion codegen
- Update `len`/`capacity` for slices

**Standard library:**
- Audit and update uses of `T[]`
