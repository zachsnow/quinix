// @expect: 42
function main(): byte {
  return fn(42);
}

function fn(a: byte): byte {
  return a;
}
