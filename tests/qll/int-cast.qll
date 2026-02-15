// @expect: 42
// Unsafe cast between int and byte.
function main(): byte {
  var a: int = 42;
  return <unsafe byte>a;
}
