// Standard library support for "bare" programs running directly on the
// QVM without a kernel.
namespace std {
  // Console IO; hardcoded to use the debug input and output peripherals.
  namespace console {
    function print(s: string): bool {
      var control: *byte = <unsafe * byte> 0x303;
      var buffer: string = <unsafe string> 0x304;
      return buffered::write(control, buffer, s);
    }

    function input(s: string): bool {
      var control = <unsafe * byte> 0x403;
      var buffer = <unsafe string> 0x404;
      return buffered::read(control, buffer, s);
    }
  }

  // Buffered IO.
  namespace buffered {
    .constant global READY: byte = 0x0;
    .constant global WRITE: byte = 0x1;
    .constant global READ: byte = 0x2;
    .constant global PENDING: byte = 0x3;
    .constant global ERROR: byte = 0x4;

    function write(control: * byte, buffer: string, data: string): bool {
      len buffer = len data;
      for(var i = 0; i < len data; i = i + 1){
        buffer[i] = data[i];
      }

      *control = WRITE;

      while(*control == PENDING){}

      return *control == READY;
    }

    function read(control: * byte, buffer: string, data: string): bool {
      *control = READ;

      while(*control == PENDING){}
      if(*control != READY){
        return false;
      }

      len data = len buffer;
      for(var i = 0; i < len buffer; i = i + 1){
        data[i] = buffer[i];
      }
      return true;
    }
  }
}
