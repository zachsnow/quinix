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
//
// NOTE: We use fixed-size arrays instead of slices because the compiler
// doesn't properly convert arrays to slices when passing as arguments.
namespace std {
  // Console IO; hardcoded to use the debug input and output peripherals.
  namespace console {
    // Print a fixed-size array. The array layout is [length][data...].
    function print<N>(s: byte[N]): bool {
      var control: *byte = <unsafe *byte> 0x300;
      var size: *byte = <unsafe *byte> 0x302;
      var buffer: *byte = <unsafe *byte> 0x303;
      return buffered::write<N>(control, size, buffer, s);
    }
  }

  // Buffered IO.
  namespace buffered {
    .constant global READY: byte = 0x0;
    .constant global WRITE: byte = 0x1;
    .constant global READ: byte = 0x2;
    .constant global PENDING: byte = 0x3;
    .constant global ERROR: byte = 0x4;

    function write<N>(control: *byte, size: *byte, buffer: *byte, data: byte[N]): bool {
      *size = len data;
      for(var i = 0; i < len data; i = i + 1){
        buffer[unsafe i] = data[i];
      }

      *control = WRITE;

      while(*control == PENDING){}

      return *control == READY;
    }
  }
}
