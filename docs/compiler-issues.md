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

## 5. Vector Null Initialization

**Issue**: Cannot initialize vectors (which are type aliases for arrays) with null.

**Example**:
```qll
type vector<T> = T[];
global processes: vector<* process> = null;
```

**Error**: `null: expected contextual pointer or unsized array type for null, actual (std::vector)<* process>`

**Expected**: Vectors (array types) should be nullable and initializable with null.

---

## 6. Delete on Vectors

**Issue**: Cannot delete vectors even though they're heap-allocated.

**Example**:
```qll
function _increase_capacity<T>(vec: * vector<T>): void {
  var v = new T[2 * capacity *vec];
  // ... copy data ...
  delete *vec;  // ERROR: expected array or pointer type, actual (vector)<T>
  *vec = v;
}
```

**Error**: `delete *vec: expected array or pointer type, actual (vector)<* process>`

**Expected**: Should be able to delete heap-allocated vectors.

**Note**: This is critical for the standard library vector implementation.

---

## 7. Delete on Strings

**Issue**: Cannot delete strings even though they're heap-allocated.

**Example**:
```qll
type file = struct {
  path: string;
  handle: byte;
};

function destroy_file(file: file): void {
  delete file.path;  // ERROR: expected array or pointer type, actual string
}
```

**Error**: `delete file.path: expected array or pointer type, actual string`

**Expected**: Should be able to delete heap-allocated strings.

---

## 8. Delete on Struct Array Fields

**Issue**: Cannot delete array fields from structs.

**Example**:
```qll
type page = struct {
  address: byte;
};

type table = struct {
  pages: page[];
};

function destroy_table(table: * table): void {
  delete table->pages;  // ERROR: expected array or pointer type, actual page[]
  delete table;
}
```

**Error**: `delete table->pages: expected array or pointer type, actual page[]`

**Expected**: Should be able to delete heap-allocated array fields.

---

## 9. Unsafe Indexing on Generic Pointers

**Issue**: Indexing on `* T` requires explicit unsafe annotation even in unsafe context.

**Example**:
```qll
function unsafe_copy<T>(destination: * T, source: * T, length: byte): void {
  for(var i = 0; i < length; i = i + 1){
    destination[i] = source[i];  // ERROR: unsafe index on * byte
  }
}
```

**Error**: `destination[i]: unsafe index on * byte`

**Expected**: Indexing on raw pointers should be allowed (it's already unsafe by nature).

**Workaround**: Use `destination[unsafe i]` syntax.

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

### Critical (blocking kernel development):
- #5: Vector null initialization
- #6: Delete on vectors (breaks std lib)
- #8: Delete on struct array fields

### High Priority:
- #7: Delete on strings

### Medium Priority:
- #9: Unsafe indexing on generic pointers
- #10: Template inference for intrusive lists

### Low Priority (has workaround):
- #4: Cast byte to array type

---

## Test Cases

See `tests/compiler-issues/` for minimal test cases for each issue.
