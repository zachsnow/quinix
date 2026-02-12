// @skip: unsafe cast between byte and pointer
function main(): byte {
  var b: * byte = null;
  var bb: ** byte = null;
  return <byte>b + <byte>bb;
}
