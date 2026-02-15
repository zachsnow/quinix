// @expect: 1
// Signed comparisons: -1 < 0 is true for int, false for byte.
function main(): byte {
  var zero: int = 0;
  var a: int = zero - 1; // -1 (0xFFFFFFFF)
  if (a < zero) {
    return 1;
  }
  return 0;
}
