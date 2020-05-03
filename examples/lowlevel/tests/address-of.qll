function main(): byte {
  var i: byte = 33;
  var p: * byte = &i;
  (*p) = 66;
  return i;
}
