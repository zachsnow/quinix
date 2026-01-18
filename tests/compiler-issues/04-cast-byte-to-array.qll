// Issue #4: Cast Byte to Array Type
//
// Expected: Should compile successfully (with unsafe cast)
// Actual: Error - expected convertible to entry[], actual byte

type entry = struct {
  id: byte;
  value: byte;
};

.constant global TABLE_ADDRESS: byte = 0x0100;

// This should work with an unsafe cast
.constant global table: entry[] = <unsafe entry[]> TABLE_ADDRESS;

function main(): byte {
  // Access the table
  var first = table[0];
  return first.id;
}
