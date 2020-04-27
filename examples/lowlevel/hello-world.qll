.constant global debugOutputControl: *byte = <unsafe * byte> 0x302;
.constant global debugOutputBuffer: *byte = <unsafe * byte> 0x303;

function print(s: byte[]): void {
  var i = 0;
  var n = len s;
  debugOutputBuffer[0] = n;
  while(i < n){
    debugOutputBuffer[i + 1] = s[i];
    i = i + 1;
  }

  *debugOutputControl = 0x1;

  while(*debugOutputControl == 0x2){}
}

function main(): byte {
    print('Hello, world!\n');
    print(new byte[] = 'Hello, heap!\n');
    return 0;
}
