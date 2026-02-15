// @expect: 0
type num = byte;
function main(): byte {
  var i: num = 0;
  return <byte>i;
}
