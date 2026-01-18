// Issue #2: Negation on Arrays
//
// Expected: Should compile successfully
// Actual: Error - expected integral type, actual byte[]

function test(): byte {
  var array = new byte[10];

  if(!array){  // ERROR: expected integral type, actual byte[]
    return 1;
  }

  return 0;
}

function main(): byte {
  return test();
}
