// Compute-intensive benchmark: nested loops with arithmetic
function main(): byte {
  var sum = 0;
  for (var i = 0; i < 1000; i = i + 1) {
    for (var j = 0; j < 100; j = j + 1) {
      sum = sum + (i * j);
    }
  }
  // Return low byte of sum
  return sum;
}
