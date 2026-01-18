// Test: Can we use 'new' in global initializers?

global my_array: byte[] = new byte[10];

function main(): byte {
  return <byte>len my_array;
}
