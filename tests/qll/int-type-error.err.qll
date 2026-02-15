// @expect-error: expected int, actual byte
// Mixing int and byte is a type error.
function main(): byte {
  var a: int = 0;
  var b: byte = 1;
  a + b;
  return 0;
}
