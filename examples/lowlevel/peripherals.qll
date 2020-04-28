//
// Hardware peripherals.
//
type peripheral_table_entry = struct {
    identifier: byte;
    address: * byte;
};

global peripheralTable: peripheral_table_entry[] = <unsafe peripheral_table_entry[]> 0x0200;

function print(s: byte[]): void {
  var debugOutputControl: *byte = <unsafe * byte> 0x302;
  var debugOutputBuffer: *byte = <unsafe * byte> 0x303;

  debugOutputBuffer[0] = len s;
  for(var i = 0; i < len s; i = i + 1){
    var c = s[i];
    debugOutputBuffer[i + 1] = c;
    if(!c){
      debugOutputBuffer[0] = i;
      break;
    }
  }

  *debugOutputControl = 0x1;

  while(*debugOutputControl == 0x2){}
}

function reverse(buffer: byte[]): void {
  var length = len buffer;
  for(var i = 0; i < length / 2; i = i + 1){
    var c = buffer[i];
    buffer[i] = buffer[length - 1 - i];
    buffer[length - 1 - i] = c;
  }
}

function itoa(number: byte, buffer: byte[], base: byte, allowNegative: bool): bool {
  var i = 0;
  var negative = false;

  if(!number){
    buffer[i] = 48;
    len buffer = 1;
    return true;
  }

  if(allowNegative && number < 0){
    negative = true;
    number = -number;
  }

  while(number != 0){
    var remainder = number % base;
    buffer[i] = remainder > 9 ?
      remainder - 10 + 97 :
      remainder + 48;
    i = i + 1;

    if(i >= len buffer){
      return false;
    }

    number = number / base;
  }

  if(negative){
    buffer[i] = 45;
    i = i + 1;
  }

  // Truncate.
  len buffer = i;

  reverse(buffer);

  return true;
}

function main(): byte {
  var buffer: byte[32];
  print('peripherals: ');
  itoa(len peripheralTable, buffer, 10, true);
  print(buffer);
  len buffer = 32;
  print('\n');
  for(var i = 0; i < len peripheralTable; i = i + 1){
    var p = peripheralTable[i];
    itoa(p.identifier, buffer, 16, false);
    print(buffer);
    len buffer = 32;
    print(': ');
    itoa(<unsafe byte>p.address, buffer, 16, false);
    print(buffer);
    len buffer = 32;
    print('\n');
  }
  return len peripheralTable;
}
