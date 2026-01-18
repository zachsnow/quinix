// Issue #3: Delete on Sized Arrays
//
// Expected: Should compile successfully
// Actual: Error - expected array or pointer type, actual byte[]

function test(): byte {
  var binary = new byte[0x1000];

  if(!binary){
    return 1;
  }

  delete binary;  // ERROR: expected array or pointer type, actual byte[]

  return 0;
}

function main(): byte {
  return test();
}
