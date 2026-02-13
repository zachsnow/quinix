// @expect: 1
// @libs: std
// @cycles: 500000
function main(): byte {
  var x: byte = 255;
  var f0 = std::fmt::fu(x);
  var f1 = std::fmt::fs(" ");
  var f2 = std::fmt::fi(-1);
  var f3 = std::fmt::fs(" ");
  var f4 = std::fmt::fp(&x);
  var f5 = std::fmt::nl;
  var fmts: std::fmt[6] = [f0, f1, f2, f3, f4, f5];
  var ok = std::fmt::print(fmts);
  return <byte>ok;
}
