// Issue #9: Unsafe Indexing on Generic Pointers
//
// Expected: Should compile successfully (indexing raw pointers is inherently unsafe)
// Actual: Error - unsafe index on * byte
//
// Note: Current workaround is to use destination[unsafe i] syntax

function unsafe_copy<T>(destination: * T, source: * T, length: byte): void {
  for(var i = 0; i < length; i = i + 1){
    destination[i] = source[i];  // ERROR: unsafe index on * byte
  }
}

function main(): byte {
  var src = new byte[] = [1, 2, 3, 4, 5];
  var dst = new byte[5];

  unsafe_copy(&src[0], &dst[0], 5);

  return dst[0];
}
