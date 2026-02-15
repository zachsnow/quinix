// @expect: 1
// Signed comparisons: -1 < 0 is true for int, false for byte.
function main(): byte {
  var a: int = -1;
  if (a < 0) {
    return 1;
  }
  return 0;
}
