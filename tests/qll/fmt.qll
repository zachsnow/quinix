// @expect: 1
// @stdout: "x=42\n"
// @libs: std
// @cycles: 500000
function main(): byte {
  var f0 = std::fmt::fs("x=");
  var f1 = std::fmt::fi(42);
  var f2 = std::fmt::fs("\n");
  var fmts: std::fmt[3] = [f0, f1, f2];
  var ok = std::fmt::print(fmts);
  return <byte>ok;
}
