//
// Print information about hardware peripherals, interrupts, and so on.
//
type peripheral_table_entry = struct {
    identifier: byte;
    address: * byte;
};

global peripheral_table: peripheral_table_entry[] = <unsafe peripheral_table_entry[]> 0x0200;

function main(): byte {
  io::printf([
    io::fs('peripherals: '),
    io::fi(len peripheral_table),
    io::fs('\n'),
  ]);

  for(var i = 0; i < len peripheral_table; i = i + 1){
    var p = peripheral_table[i];
    io::printf([
      io::fu(p.identifier),
      io::fs(': '),
      io::fu(p.address),
      io::fs('\n'),
    ]);
  }

  return len peripheral_table;
}
