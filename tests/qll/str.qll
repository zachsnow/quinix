// @skip: type mismatch byte[] vs * byte
function main(): byte {
  var s: * byte = "Hello!";
  return s[0];
}
