// @skip: inline array literal of multi-word structs corrupts elements after the first
// @expect: 1
// @libs: std
// @cycles: 500000
function main(): byte {
  var ok = std::fmt::print([
    std::fmt::fs("hello"),
    std::fmt::fs("\n"),
  ]);
  return <byte>ok;
}
