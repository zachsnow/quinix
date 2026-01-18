// Test: Are uninitialized globals zero-initialized?

global my_byte: byte;
global my_pointer: * byte;
global my_array: byte[];  // Slice

function main(): byte {
  // If zero-initialized, these should all be 0
  if(my_byte != 0){
    return 1;
  }

  if(<unsafe byte>my_pointer != 0){
    return 2;
  }

  // For slice, check if pointer is null
  if(<unsafe byte>&my_array[0] != 0){
    return 3;
  }

  if(len my_array != 0){
    return 4;
  }

  if(cap my_array != 0){
    return 5;
  }

  return 0;  // All zero!
}
