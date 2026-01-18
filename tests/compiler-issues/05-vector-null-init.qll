// Issue #5: Vector Null Initialization
//
// Expected: Should compile successfully
// Actual: Error - expected contextual pointer or unsized array type for null

namespace std {
  type vector<T> = T[];

  namespace vector {
    function create<T>(n: byte): vector<T> {
      var v = new T[n];
      len v = 0;
      return v;
    }
  }
}

type process = struct {
  id: byte;
};

// This should work - vectors are array types which should be nullable
global processes: std::vector<* process> = null;

function main(): byte {
  processes = std::vector::create<* process>(10);
  return 0;
}
