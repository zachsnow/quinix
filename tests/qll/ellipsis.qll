// @skip: system::alloc assembly reference not resolved
function main(): byte {
  var b = new byte [5] ... 17;
  return b[3];
}
