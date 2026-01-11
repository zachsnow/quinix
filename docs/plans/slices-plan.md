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
4. `capacity` on arrays wastes a word (it's always N, known at compile time)

## Proposed Design

### Arrays `T[N]`

Fixed-size inline storage with length header for uniform bounds checking.

```
Memory layout: [length][elem0][elem1]...[elemN-1]
Size: N + 1 words
```

- `length` = current number of valid elements (runtime, <= N)
- `capacity` = N (compile-time constant, not stored)
- Data is inline, immediately after length

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
| `capacity x` | returns N (compile-time) | returns capacity field |
| `x[i]` | bounds check vs length, access elem | bounds check vs length, access via pointer |
| `x[lo:hi]` | creates slice | creates slice |
| `len x = n` | sets length (must be <= N) | sets length (must be <= capacity) |

### Conversions

**Array to slice (implicit):**
When a `T[N]` is used where `T[]` is expected, create a slice:
- pointer = address of elem0 (array address + 1)
- length = array's length field
- capacity = N (compile-time constant)

**Slice to array: not allowed** (size unknown at compile time)

### Heap Allocation

`new T[N]` allocates on heap and returns `T[]`:
- Allocates: `[length][elem0]...[elemN-1]` (N + 1 words)
- Returns slice: pointer to elem0, length=0, capacity=N

### Slice Expression `x[lo:hi]`

Creates a new slice from array or slice:
- `lo` defaults to 0
- `hi` defaults to `len x`
- Result: pointer = &x[lo], length = hi - lo, capacity = (capacity x) - lo

Bounds: 0 <= lo <= hi <= capacity x

## Implementation Steps

### Phase 1: Simplify ArrayType, Add SliceType

1. Update `ArrayType` in `types.ts`
   - Remove capacity from layout, size becomes N + 1
   - `length` is required (no more optional)

2. Create `SliceType` class in `types.ts`
   - `size` = 3
   - `index()` returns element type
   - Unifiable only with slices of same element type

3. Change type parsing
   - `T[]` creates `SliceType`, not `ArrayType` with undefined length
   - `T[N]` creates `ArrayType`

4. Update type unification
   - `T[N]` implicitly converts to `T[]`
   - Add `isConvertibleTo` check for array-to-slice

### Phase 2: Update Codegen

5. Update `IndexExpression` compilation
   - For arrays: skip length header (1 word), access inline data
   - For slices: load pointer from slice, then access via pointer

6. Update `len` and `capacity` expressions
   - For arrays: `len` reads length field, `capacity` emits constant N
   - For slices: `len` reads offset 1, `capacity` reads offset 2

7. Update array-to-slice conversion codegen
   - Emit code to construct 3-word slice from array

8. Update `NewArrayExpression` to return slice
   - Allocate N + 1 words on heap
   - Return slice pointing to data

### Phase 3: Add Slice Expression

9. Add `SliceExpression` class in `expressions.ts`
    - Typecheck: input must be array or slice, bounds must be numeric
    - Returns `SliceType`

10. Add parser grammar for `x[lo:hi]`
    - `x[:]` = full slice
    - `x[lo:]` = from lo to end
    - `x[:hi]` = from start to hi
    - `x[lo:hi]` = from lo to hi

11. Wire up `SuffixExpression.build` to create `SliceExpression`

### Phase 4: Update Standard Library

12. Update `std::vector` to use new slice semantics
13. Update any code using `T[]` as raw pointer

## Code Changes Summary

**types.ts:**
- Update `ArrayType.size` to N + 1 (drop capacity)
- Add `SliceType` class
- Update type parsing for `T[]` vs `T[N]`

**expressions.ts:**
- Add `SliceExpression` class
- Update `IndexExpression.compile` for arrays (1 word header) and slices (pointer indirection)
- Update `SuffixExpression.build` for slice case
- Update `LenExpression` and `CapacityExpression` for slices

**expressions-parser.pegjs:**
- Add slice syntax `[lo:hi]`

**compiler.ts:**
- Add array-to-slice conversion codegen
- Update `NewArrayExpression` to return slice

**Standard library:**
- Audit and update uses of `T[]`
