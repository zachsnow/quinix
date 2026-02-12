// @skip: unsafe cast between byte and byte[]
function main(): byte {
  var b = new byte[4];
  return <byte>b;
}
