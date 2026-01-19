// Issue #4: Cast Byte to Array Type
//
// Expected: Should compile successfully with unsafe cast
// Solution: Allow unsafe casts from integral types to sized arrays for memory-mapped I/O

type entry = struct {
  id: byte;
  value: byte;
};

// Simulate memory-mapped peripheral table
// Layout at 0x1000: [count][entry0.id][entry0.value][entry1.id][entry1.value]...
function setup_memory(): void {
  var addr: * byte = <unsafe * byte> 0x1000;
  addr[unsafe 0] = 2;  // count = 2
  addr[unsafe 1] = 10; // entry0.id
  addr[unsafe 2] = 20; // entry0.value
  addr[unsafe 3] = 30; // entry1.id
  addr[unsafe 4] = 40; // entry1.value
}

function test_cast_to_sized_array(): byte {
  setup_memory();
  
  // Cast memory address to sized array
  var table: entry[128] = <unsafe entry[128]> 0x1000;
  
  // Verify length
  if (len table != 2) {
    return 1;
  }
  
  // Verify first entry
  if (table[0].id != 10) {
    return 2;
  }
  if (table[0].value != 20) {
    return 3;
  }
  
  // Verify second entry
  if (table[1].id != 30) {
    return 4;
  }
  if (table[1].value != 40) {
    return 5;
  }
  
  return 0;
}

function main(): byte {
  return test_cast_to_sized_array();
}
