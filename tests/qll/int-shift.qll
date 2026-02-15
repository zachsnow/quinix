// @expect: 1
// Arithmetic right shift preserves sign bit.
// -4 >> 1 = -2 (SAR), not 0x7FFFFFFE (SHR).
function main(): byte {
  var zero: int = 0;
  var a: int = zero - 4; // -4
  var b: int = a >> 1;   // arithmetic shift: -2
  var c: int = zero - 2; // -2
  if (b == c) {
    return 1;
  }
  return 0;
}
