// Memory-intensive benchmark: array fill + sum exercising load/store patterns.
function main(): byte {
  var buffer: byte[1024];

  // Fill array with values.
  for (var i = 0; i < 1024; i = i + 1) {
    buffer[i] = i;
  }

  // Sum the array 100 times.
  var sum = 0;
  for (var round = 0; round < 100; round = round + 1) {
    for (var j = 0; j < 1024; j = j + 1) {
      sum = sum + buffer[j];
    }
  }

  return sum;
}
