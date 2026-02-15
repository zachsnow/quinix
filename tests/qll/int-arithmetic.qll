// @expect: 1
// Signed division: -7 / 2 = -3 (SDIV, truncates toward zero).
function main(): byte {
  var zero: int = 0;
  var a: int = 7;
  var b: int = zero - a; // -7
  var c: int = b / 2;    // -7 / 2 = -3
  var d: int = zero - 3; // -3
  if (c == d) {
    return 1;
  }
  return 0;
}
