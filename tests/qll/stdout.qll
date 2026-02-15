// @expect: 0
// @stdout: "Hello, world!\n"
// @libs: std
// @cycles: 50000
function main(): byte {
  std::console::print("Hello, world!\n");
  return 0;
}
