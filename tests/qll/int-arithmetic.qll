// @expect: 1
// Signed division: -7 / 2 = -3 (SDIV, truncates toward zero).
function main(): byte {
  var a: int = -7;
  var c: int = a / 2;    // -7 / 2 = -3
  if (c == -3) {
    return 1;
  }
  return 0;
}
