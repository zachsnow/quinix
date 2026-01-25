// Test: Can we initialize a global slice using the slice<T> struct?

namespace std {
  type slice<T> = struct {
    pointer: * T;
    length: byte;
    capacity: byte;
  };
}

global empty_slice: byte[] = std::slice<byte> {
  pointer = null,
  length = 0,
  capacity = 0,
};

function main(): byte {
  if(len empty_slice != 0){
    return 1;
  }
  if(cap empty_slice != 0){
    return 2;
  }
  return 0;  // Success - it"s empty!
}
