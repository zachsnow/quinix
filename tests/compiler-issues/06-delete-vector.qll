// Issue #6: Delete on Vectors
//
// Expected: Should compile successfully
// Actual: Error - expected array or pointer type, actual (vector)<T>

namespace std {
  type vector<T> = T[];

  namespace vector {
    function create<T>(n: byte): vector<T> {
      var v: T[] = new T[n];
      len v = 0;
      return v;
    }

    function destroy<T>(vec: * vector<T>): void {
      delete *vec;  // Now works!
    }

    function _increase_capacity<T>(vec: * vector<T>): void {
      var v: T[] = new T[2 * cap *vec];
      len v = len *vec;
      for(var i = 0; i < len v; i = i + 1){
        v[i] = (*vec)[i];
      }
      delete *vec;  // Now works!
      *vec = v;
    }
  }
}

function main(): byte {
  var vec = std::vector::create<byte>(10);
  std::vector::destroy(&vec);
  return 0;
}
