// @expect: 0
// @libs: alloc
function main(): byte {
  var b = new byte[4];
  b[0] = 42;
  return b[0] - 42;
}
