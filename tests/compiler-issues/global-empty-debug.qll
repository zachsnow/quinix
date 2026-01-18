// Debug test for empty array

global empty_slice: byte[] = new byte[0];

function main(): byte {
  var l = len empty_slice;
  var c = cap empty_slice;

  // Can't print, so return different codes
  if(l == 0 && c == 0){
    return 0;  // Perfect!
  }
  if(l != 0){
    return 10 + <byte>l;  // Return 10 + length
  }
  if(c != 0){
    return 20 + <byte>c;  // Return 20 + capacity
  }
  return 99;  // Unknown
}
