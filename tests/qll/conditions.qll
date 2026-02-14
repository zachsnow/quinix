// @expect: 10
type pair = struct { lo: byte; hi: byte; };
function main(): byte {
  var i = 0;

  if (1 && 2) {
    i = 10;
  }

  var p: *pair = null;
  if (!!0 && p->hi >= 4) {
    i = 11;
  }

  return i;
}
