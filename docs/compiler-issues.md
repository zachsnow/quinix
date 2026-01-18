# QLL Compiler Issues

Found during kernel implementation (2026-01-17)

## 1. ~~Nested Namespace Function Resolution~~ (NOT A BUG)

**Status**: This was not a compiler bug - just a missing file in the kernel build script.

**Resolution**: Added `syscall.qll` to `kernel/build.sh`.

---

## 2. ~~Negation on Arrays~~ (FIXED)

**Status**: Fixed as of 2026-01-18.

**Solution**: Changed `new T[N]` to return `* T[N]` (pointer to array) instead of `T[]` (slice). Pointers are integral types that support negation. Added automatic conversion from `* T[N]` → `T[]` at assignment, call arguments, return values, and literal initialization sites.

**Example** (now works):
```qll
var binary = new byte[0x1000];  // Returns * byte[0x1000]
if(!binary){  // ✓ Works: pointers are integral
  return;
}

// Automatic conversion to slice when needed:
function takes_slice(data: byte[]): void { }
takes_slice(binary);  // ✓ Converts * byte[0x1000] → byte[]
```

**Test**: `tests/compiler-issues/02-array-negation.qll`

---

## 3. ~~Delete on Sized Arrays~~ (FIXED)

**Status**: Fixed as of 2026-01-18 (same fix as #2).

**Solution**: Since `new T[N]` now returns `* T[N]` (pointer), it can be deleted directly.

**Example** (now works):
```qll
var binary = new byte[0x1000];  // Returns * byte[0x1000]
delete binary;  // ✓ Works: can delete pointers
```

**Test**: `tests/compiler-issues/03-delete-sized-array.qll`

---

## 4. Cast Byte to Array Type

**Issue**: Cannot cast a byte constant to an array type.

**Example**:
```qll
type entry = struct { id: byte; };
.constant global table: entry[] = <unsafe entry[]> 0x0100;
```

**Error**: `<unsafe peripheral_table_entry[]> 0x0100: expected convertible to peripheral_table_entry[], actual byte`

**Expected**: Unsafe cast should allow treating a memory address as an array.

**Workaround**: Cast to pointer first, then dereference.

---

## 5. ~~Vector Null Initialization~~ (NOT A BUG)

**Status**: This works by using `std::slice<T>` instead of `T[]` as the vector definition.

**Solution**: The `std::slice<T>` struct type is structurally identical to `T[]` but supports struct literal initialization syntax.

**Example** (working approach):
```qll
namespace std {
  type slice<T> = struct {
    pointer: * T;
    length: byte;
    capacity: byte;
  };
}

// Use std::slice<T>, not T[]
type vector<T> = std::slice<T>;

// Now this works!
global processes: vector<* process> = vector<* process> {
  pointer = null,
  length = 0,
  capacity = 0,
};
```

**Why This Works**:
- `T[]` (SliceType) doesn't support struct literal syntax
- `std::slice<T>` (StructType) is structurally identical but supports literals
- Both support the same operators: `len`, `cap`, indexing, `delete`, etc.
- This is actually better than `= null` because it's explicit about all three fields

**Test**: `tests/compiler-issues/05-vector-null-init.qll`

---

## 6. ~~Delete on Vectors~~ (FIXED)

**Status**: Fixed as of 2026-01-18.

**Solution**: Extended `delete` to accept SliceType. When deleting a slice:
1. Frees the heap memory pointed to by `slice.pointer`
2. Zeros out the slice descriptor (pointer=null, length=0, capacity=0)
3. Requires the slice expression to be an l-value (assignable)

**Example** (now works):
```qll
type vector<T> = T[];

function destroy<T>(vec: * vector<T>): void {
  delete *vec;  // ✓ Works! Frees heap data and zeros the slice
}

// After delete:
// - vec.pointer is null
// - vec.length is 0
// - vec.capacity is 0
// - Double-delete is safe (deleting null is a no-op)
```

**Test**: `tests/compiler-issues/06-delete-vector.qll`

---

## 7. ~~Delete on Strings~~ (FIXED)

**Status**: Fixed as of 2026-01-18 (same fix as #6).

**Solution**: Since `string` is convertible to `byte[]` (SliceType), delete now works on strings.

**Example** (now works):
```qll
type file = struct {
  path: string;
  handle: byte;
};

function destroy_file(f: * file): void {
  delete f->path;  // ✓ Works! Frees the string data and zeros the slice
}
```

**Test**: `tests/compiler-issues/07-delete-string.qll`

---

## 8. ~~Delete on Struct Array Fields~~ (FIXED)

**Status**: Fixed as of 2026-01-18 (same fix as #6).

**Solution**: Slice fields in structs can now be deleted, which frees the heap data and zeros the field.

**Example** (now works):
```qll
type table = struct {
  pages: page[];
};

function destroy_table(t: * table): void {
  delete t->pages;  // ✓ Works! Frees the array and zeros the field
  delete t;
}
```

**Test**: `tests/compiler-issues/08-delete-struct-array-field.qll`

---

## 9. ~~Unsafe Indexing on Generic Pointers~~ (NOT A BUG)

**Status**: This is intentional behavior, not a bug.

**Design Decision**: Indexing raw pointers (`* T`) is intentionally verbose to discourage unsafe pointer arithmetic. Users should prefer:
- Slices (`T[]`) for dynamic arrays with bounds checking
- Sized arrays (`T[N]`) for fixed-size arrays with known length

**Example**:
```qll
// Discouraged: raw pointer indexing (requires explicit unsafe)
function unsafe_copy<T>(destination: * T, source: * T, length: byte): void {
  for(var i = 0; i < length; i = i + 1){
    destination[unsafe i] = source[unsafe i];  // Explicit unsafe required
  }
}

// Preferred: use slices with proper bounds
function safe_copy(destination: byte[], source: byte[]): void {
  var n = len source;
  if (n > cap destination) {
    n = cap destination;
  }
  for(var i = 0; i < n; i = i + 1){
    destination[i] = source[i];  // Safe - bounds are known
  }
}
```

**Rationale**: Raw pointer indexing is dangerous (no bounds, can corrupt memory). The explicit `unsafe` annotation makes it clear where the danger is.

---

## 10. Template Inference for Intrusive Lists

**Issue**: Template inference fails for intrusive list operations.

**Example**:
```qll
namespace std {
  namespace ilist {
    function remove<T>(ilist: T, el: T): void {
      // ...
    }
  }
}

// Usage:
type task = struct {
  next: * task;
};

global tasks: * task = null;
var task: * task = /* ... */;

std::ilist::remove(&tasks, task);  // ERROR: unable to infer template instantiation
```

**Error**: `std::ilist::remove(&tasks, task): unable to infer template instantiation, actual <T>(T, T) => void`

**Expected**: Should infer `T = * task` from the arguments.

---

## Summary

### Fixed:
- ~~#1: Nested namespace resolution~~ (not a bug)
- ~~#2: Negation on arrays~~ (fixed 2026-01-18)
- ~~#3: Delete on sized arrays~~ (fixed 2026-01-18)
- ~~#6: Delete on vectors~~ (fixed 2026-01-18)
- ~~#7: Delete on strings~~ (fixed 2026-01-18)
- ~~#8: Delete on struct array fields~~ (fixed 2026-01-18)
- ~~#9: Unsafe indexing on generic pointers~~ (not a bug - intentional design)

### Critical (blocking kernel development):
- #5: Vector null initialization

### Medium Priority:
- #10: Template inference for intrusive lists

### Low Priority (has workaround):
- #4: Cast byte to array type

---

## Test Cases

See `tests/compiler-issues/` for minimal test cases for each issue.
