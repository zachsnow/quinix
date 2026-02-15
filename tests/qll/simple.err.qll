// @expect-error: unknown type identifier num
function main(): byte {
  var i: byte = 42;
  var k: num = 0;
  var z: byte = i == k;
  return &i;
}
