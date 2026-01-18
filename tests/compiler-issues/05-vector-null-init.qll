// Issue #5: Vector Null Initialization
//
// Expected: Should compile successfully using std::slice<T> syntax
// Solution: Use std::slice<T> struct type instead of T[] for vectors

namespace std {
  type slice<T> = struct {
    pointer: * T;
    length: byte;
    capacity: byte;
  };
}

type process = struct {
  id: byte;
};

// Key: Use std::slice<T>, not T[]
type vector<T> = std::slice<T>;

// This now works with struct literal syntax!
global processes: vector<* process> = vector<* process> {
  pointer = null,
  length = 0,
  capacity = 0,
};

function main(): byte {
  // Verify global is null-initialized
  if (len processes != 0) {
    return 1;  // Length should be 0
  }

  if (cap processes != 0) {
    return 2;  // Capacity should be 0
  }

  // Can also create local null vectors
  var empty: vector<byte> = vector<byte> {
    pointer = null,
    length = 0,
    capacity = 0,
  };

  if (len empty != 0) {
    return 3;  // Should be 0
  }

  if (cap empty != 0) {
    return 4;  // Should be 0
  }

  return 0;  // Success!
}
