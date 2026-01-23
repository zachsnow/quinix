// Test program B - prints 'B' repeatedly
function main(): byte {
  var i = 0;
  while (i < 10) {
    lib::print('B\n');
    i = i + 1;
  }
  lib::exit(0);
  return 0;
}
