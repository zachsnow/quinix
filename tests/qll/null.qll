// @expect: 0
function main(): byte {
  var b: * byte = null;
  var bb: ** byte = null;
  return <unsafe byte>b + <unsafe byte>bb;
}
