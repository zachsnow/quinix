// @expect: 1
// @stdout: "hello\n"
// @libs: std
// @cycles: 500000
function main(): byte {
  var ok = std::fmt::print([
    std::fmt::fs("hello"),
    std::fmt::fs("\n"),
  ]);
  return <byte>ok;
}
