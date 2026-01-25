// Test: Delete on vector (type alias for slice)
//
// This is the actual issue #6 - delete on vectors.
// Vector is just a type alias for T[], so it should work with our slice delete.

namespace std {
  type vector<T> = T[];

  namespace vector {
    function create<T>(n: byte): vector<T> {
      var v: T[] = new T[n];
      len v = 0;
      return v;
    }

    function destroy<T>(vec: * vector<T>): void {
      delete *vec;  // Delete through pointer to zero out the original
    }
  }
}

function test_vector_delete(): byte {
  // Create a vector
  var vec = std::vector::create<byte>(10);

  // Destroy it (should delete and zero out)
  std::vector::destroy(&vec);

  // Verify it"s zeroed after delete
  if (len vec != 0) {
    return 1;  // Length should be 0
  }

  if (cap vec != 0) {
    return 2;  // Capacity should be 0
  }

  return 0;  // Success
}

function main(): byte {
  return test_vector_delete();
}
