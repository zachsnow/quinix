// @expect: 10
type bytefn = () => byte;

function one(): byte {
  return 10;
}

function two(): byte {
  return 20;
}

function main(): byte {
  var fn: bytefn = one;
  return fn();
}
