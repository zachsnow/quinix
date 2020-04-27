namespace kernel {
  // Assembly-level support functions.
  namespace support {
    function halt(code: byte): void;
    function wait(): byte;

    function interrupt(interrupt: byte, handler: () => void): void;
  }

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

  .interrupt function _on_timer(): void {
    print('Tick...\n');
  }

  function init(): void {
    kernel::support::interrupt(0x2, _on_timer);

    var timerControl = <unsafe * byte>0x300;
    *timerControl = 1000;
  }
}

function main(): void {
  kernel::init();
  kernel::support::wait();
}
