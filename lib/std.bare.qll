// Standard library support for "bare" programs running directly on the
// QVM without a kernel.
//
// Uses memory-mapped I/O to communicate with BufferedPeripheral:
//   base+0: control
//   base+1: capacity
//   base+2: size
//   base+3+: buffer data
//
// DebugOutputPeripheral (0x3) is at base 0x300.
// DebugInputPeripheral (0x4) is at base 0x400.
namespace std {
  // Console IO; hardcoded to use the debug input and output peripherals.
  namespace console {
    function print(s: string): bool {
      var control: *byte = <unsafe *byte> 0x300;
      var size: *byte = <unsafe *byte> 0x302;
      var buffer: *byte = <unsafe *byte> 0x303;
      return buffered::write(control, size, buffer, s);
    }
  }

  // Buffered IO.
  namespace buffered {
    .constant global READY: byte = 0x0;
    .constant global WRITE: byte = 0x1;
    .constant global READ: byte = 0x2;
    .constant global PENDING: byte = 0x3;
    .constant global ERROR: byte = 0x4;

    function write(control: *byte, size: *byte, buffer: *byte, data: string): bool {
      *size = len data;
      for(var i = 0; i < len data; i = i + 1){
        buffer[unsafe i] = data[i];
      }

      *control = WRITE;

      while(*control == PENDING){}

      return *control == READY;
    }

    function read_size(control: *byte, size: *byte): byte {
      return *size;
    }

    function read(control: *byte, size: *byte, buffer: *byte, data: byte[]): bool {
      *control = READ;

      while(*control == PENDING){}

      if(*control != READY){
        return false;
      }

      var read_size = *size;
      if(read_size > cap data){
        read_size = cap data;
      }

      for(var i = 0; i < read_size; i = i + 1){
        data[i] = buffer[unsafe i];
      }
      len data = read_size;

      return true;
    }
  }
}
