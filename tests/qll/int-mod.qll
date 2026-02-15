// @expect: 1
// Signed modulo: -7 % 3 = -1 (SMOD).
function main(): byte {
  var zero: int = 0;
  var a: int = zero - 7;    // -7
  var b: int = a % 3;       // -7 % 3 = -1
  var expected: int = zero - 1; // -1
  if (b == expected) {
    return 1;
  }
  return 0;
}
