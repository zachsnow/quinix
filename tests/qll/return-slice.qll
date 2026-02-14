// @expect: 0x48
function make(): string {
  return "Hello";
}
function main(): byte {
  var s = make();
  return s[0];
}
