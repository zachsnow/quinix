
function print(message: byte[]): void {
  var debugOutputControl = <unsafe * byte> 0x302;
  var debugOutputBuffer = <unsafe * byte> 0x303;

  // Copy.
  debugOutputBuffer[0] = len message;
  for(var i = 0; i < len message && i < 32; i = i + 1){
    debugOutputBuffer[i + 1] = message[i];
  }

  // Write.
  *debugOutputControl = 0x1;

  // Wait for success.
  while(*debugOutputControl == 0x2){}
}

.interrupt function tick(): void {
  print('Tick...\n');
}

function main(): void {
  var handlerTableAddressPtr = <unsafe * byte>0x1;
  var handlerAddress = <unsafe * byte>(*handlerTableAddressPtr + 0x2);
  *handlerAddress = tick;

}
