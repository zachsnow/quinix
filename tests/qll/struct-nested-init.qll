// @expect: 7
// @cycles: 5000
type Inner = struct { a: byte; b: byte; };
type Outer = struct { inner: Inner; c: byte; };

function main(): byte {
  var o = Outer { inner = Inner { a = 3, b = 4 }, c = 7 };
  return o.c;
}
