# QLL Language Specification

QLL is a C-like systems programming language targeting the Quinix virtual machine.

## Types

### Primitive Types

| Type | Size | Description |
|------|------|-------------|
| `byte` | 1 word | Unsigned integer (32-bit on Quinix VM) |
| `bool` | 1 word | Boolean value (0 = false, non-zero = true) |
| `void` | 0 | No value; only valid as function return type |

### Compound Types

| Type | Syntax | Description |
|------|--------|-------------|
| Pointer | `* T` | Address of a value of type T |
| Array | `T[N]` | Fixed-size array of N elements of type T |
| Slice | `T[]` | View into contiguous memory of elements of type T |
| Struct | `struct { ... }` | Composite type with named fields |
| Function | `(T1, T2) => R` | Function type with argument and return types |

## Memory Layout

### Structs

Structs are laid out sequentially in memory with no padding:

```qll
type point = struct {
  x: byte;    // offset 0
  y: byte;    // offset 1
};
// sizeof point = 2
```

Nested structs are flattened:

```qll
type rect = struct {
  origin: point;  // offset 0 (x at 0, y at 1)
  size: point;    // offset 2 (x at 2, y at 3)
};
// sizeof rect = 4
```

### Arrays

Fixed-size arrays contain only their elements with no metadata:

```qll
var arr: byte[5];
// Memory: [elem0][elem1][elem2][elem3][elem4]
// sizeof byte[5] = 5
```

For multi-word element types:

```qll
var points: point[3];
// Memory: [p0.x][p0.y][p1.x][p1.y][p2.x][p2.y]
// sizeof point[3] = 6
```

### Slices

Slices are three-word descriptors that reference contiguous memory:

```qll
var s: byte[];
// Memory layout of slice descriptor:
// [pointer: * byte][length: byte][capacity: byte]
// sizeof byte[] = 3
```

The slice descriptor is separate from the data it references. The data may be on the stack, heap, or in static memory.

## Passing Semantics

QLL uses **pass-by-value** for all types. All arguments are passed on the stack (cdecl-style).

### Integral Types (size = 1)

Pushed as a single word:
- `byte`, `bool`
- Pointers (`* T`)
- Single-word structs

```qll
function increment(x: byte): byte {
  return x + 1;  // x is a copy on the stack
}
```

### Non-Integral Types (size > 1)

Copied onto the stack as multiple words:
- Multi-word structs
- Fixed-size arrays
- Slices (3 words)

```qll
function area(r: rect): byte {
  // r is a copy of the rect (4 words copied to stack)
  return r.size.x * r.size.y;
}

function sum(arr: byte[5]): byte {
  // arr is a copy of the entire array (5 words copied)
  var total: byte = 0;
  for (var i = 0; i < 5; i = i + 1) {
    total = total + arr[i];
  }
  return total;
}
```

### Slices: Value Semantics with Reference Behavior

Slices are passed by value (3-word descriptor copied), but since the descriptor contains a pointer, modifications through the slice affect the original data:

```qll
function zero_first(s: byte[]): void {
  // s is a copy of the descriptor, but s[0] modifies original data
  s[0] = 0;
}

function main(): byte {
  var arr: byte[3] = [1, 2, 3];
  var s: byte[] = arr;  // creates slice descriptor
  zero_first(s);        // passes copy of descriptor
  return arr[0];        // returns 0 (modified through slice)
}
```

### Returning Non-Integral Values

Functions returning multi-word values receive a hidden first parameter: a pointer to caller-allocated storage. The callee writes the return value to this location.

```qll
function make_point(x: byte, y: byte): point {
  return point { x = x, y = y };
}

// Compiled as if:
// function make_point(_ret: * point, x: byte, y: byte): void {
//   *_ret = point { x = x, y = y };
// }
```

## Automatic Conversions

QLL performs implicit conversions in these cases:

### Array to Slice: `T[N]` → `T[]`

When a fixed-size array is used where a slice is expected, a slice descriptor is created automatically:

```qll
function print(data: byte[]): void { ... }

function main(): void {
  var arr: byte[5] = [1, 2, 3, 4, 5];
  print(arr);  // arr converted to slice: { pointer: &arr, length: 5, capacity: 5 }
}
```

The conversion creates a temporary slice descriptor on the stack. The descriptor's pointer points to the original array data.

### Pointer-to-Array to Slice: `* T[N]` → `T[]`

Pointers to arrays also convert to slices:

```qll
function process(data: byte[]): void { ... }

function main(): void {
  var arr: byte[10];
  var p: * byte[10] = &arr;
  process(p);  // p converted to slice: { pointer: p, length: 10, capacity: 10 }
}
```

### No Other Implicit Conversions

QLL does not perform:
- Numeric promotions or truncations
- Pointer type coercions
- Struct-to-struct conversions

Use explicit casts with `<T>expr` or `<unsafe T>expr`.

## Slice Operations

### Creation

From arrays (automatic conversion):
```qll
var arr: byte[5];
var s: byte[] = arr;  // slice pointing to arr
```

From heap allocation:
```qll
var s: byte[] = new byte[10];  // heap-allocated, returns slice
```

### Indexing

```qll
var x = s[i];     // bounds-checked read
s[i] = value;     // bounds-checked write
s[unsafe i] = v;  // unchecked (no bounds check)
```

### Slicing (Sub-slices)

```qll
var sub = s[lo:hi];   // elements [lo, hi), length = hi - lo
var sub = s[lo:];     // elements [lo, len), length = len - lo
var sub = s[:hi];     // elements [0, hi), length = hi
var sub = s[:];       // copy of descriptor, same data
```

Sub-slicing creates a new descriptor; the underlying data is shared.

### Length and Capacity

```qll
var length = len s;      // current length
var capacity = cap s;    // maximum capacity
```

For fixed-size arrays, `len` and `cap` return compile-time constants:
```qll
var arr: byte[5];
var n = len arr;  // compile-time constant 5
```

### Pointer Extraction

To get the underlying pointer (for FFI or unsafe operations):
```qll
var p: * byte = <unsafe * byte>s;  // extracts pointer from slice
```

## Zero-Length Arrays

Zero-length arrays (`T[0]`) are used for flexible array members in structs:

```qll
type buffer = struct {
  length: byte;
  data: byte[0];  // placeholder for variable-length data
};
```

Accessing elements requires unsafe indexing since compile-time length is 0:
```qll
var b: * buffer = ...;
var first = b->data[unsafe 0];  // unsafe: no bounds check
```

## Heap Allocation

### Allocation

```qll
var p: * T = new T;           // allocate single value, returns pointer
var s: T[] = new T[n];        // allocate array, returns slice
var s: T[] = new T[n] ... v;  // allocate and fill with value v
```

`new T[n]` returns a slice (not a pointer) because the runtime length `n` must be preserved.

### Deallocation

```qll
delete p;   // deallocate pointer
delete s;   // deallocate slice's underlying memory
```

## Unsafe Operations

The `unsafe` keyword bypasses safety checks:

```qll
// Unsafe casts
var p: * byte = <unsafe * byte>address;

// Unsafe indexing (no bounds check)
var x = arr[unsafe i];

// Unsafe pointer arithmetic
var next = <unsafe * byte>(<byte>p + 1);
```

## Type Aliases

```qll
type handle = byte;
type callback = (byte) => void;
type point = struct { x: byte; y: byte; };
```

Type aliases create distinct types. Values must be explicitly cast:
```qll
type meters = byte;
type feet = byte;

var m: meters = 100;
var f: feet = <feet>m;  // explicit cast required
```

## Calling Convention

### Argument Passing

All arguments are passed on the stack. Arguments are evaluated left-to-right and pushed in that order. Since the stack grows downward, this means the last argument ends up at the lowest address (closest to SP).

For a call `f(a, b, c)`, the stack looks like:
```
low addr   [c][b][a][return_addr]...   high addr
           ^SP
```

The callee accesses arguments at positive offsets from the frame pointer.

### Return Values

- **Integral types (size = 1)**: Returned in register R0
- **Non-integral types (size > 1)**: Caller allocates storage and passes a pointer as a hidden first argument; callee writes to this address

### Stack Frame Layout

```
argument 1          : the first function argument
...
argument n          : the last function argument

return address      : the return address to jump to at the end

local n             : storage for the first local
...
local 1             : storage for the last local

temporary storage   : any temporary storage needed
...

callee save 1       : the first callee-saved register
...
callee save n       : the last callee-saved register

stack frame address : address of return address on stack
```

### Non-Integral Return Values

For functions returning multi-word values, a destination pointer is passed as the first argument:

```
$return             : pointer to caller-allocated storage for return value
argument 1          : the first function argument
...
argument n          : the last function argument
...
```

The callee writes the return value to `$return` before returning. The caller then reads from its allocated storage.

## Pointer Syntax

### Dereference and Member Access

```qll
var p: * point = ...;
var x = (*p).x;      // dereference, then access member
var x = p->x;        // shorthand for (*p).x
```

### Pointer-to-Array Indexing

```qll
var p: * byte[10] = &arr;
var x = (*p)[i];     // dereference, then index
var x = p->[i];      // shorthand for (*p)[i]
```
