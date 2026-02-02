// Test: Can we use "new T[0]" for empty slice in globals?

global empty_slice: byte[] = new byte[0];

function main(): byte {
  if(len empty_slice != 0){
    return 1;
  }
  if(cap empty_slice != 0){
    return 2;
  }
  return 0;  // Success - it's empty!
}
