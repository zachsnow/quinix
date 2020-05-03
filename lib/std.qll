///////////////////////////////////////////////////////////////////////
// Quinix Standard Library
///////////////////////////////////////////////////////////////////////
namespace std {
  namespace math {
    function max(i: byte, j: byte): byte {
      return i > j ? i : j;
    }
    function min(i: byte, j: byte): byte {
      return i < j ? i : j;
    }
  }

  namespace string {
    function reverse(buffer: byte[]): void {
      var length = len buffer;
      for(var i = 0; i < length / 2; i = i + 1){
        var c = buffer[i];
        buffer[i] = buffer[length - 1 - i];
        buffer[length - 1 - i] = c;
      }
    }

    function ntoa(number: byte, buffer: byte[], base: byte, allowNegative: bool): bool {
      // We always need at least 1 byte.
      if(len buffer < 1){
        return false;
      }

      var negative = false;
      if(allowNegative && number < 0){
        negative = true;
        number = -number;
      }

      var i = 0;
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

      // Handle 0.
      if(i == 0){
        buffer[i] = 48;
        i = i + 1;
      }

      // Sign.
      if(negative){
        if(i >= len buffer){
          return false;
        }
        buffer[i] = 45;
        i = i + 1;
      }

      // Truncate.
      len buffer = i;

      reverse(buffer);

      return true;
    }

    function itoa(number: byte, buffer: byte[], base: byte): bool {
      return ntoa(number, buffer, base, true);
    }

    function utoa(number: byte, buffer: byte[], base: byte): bool {
      return ntoa(number, buffer, base, false);
    }
  }

  // Buffered IO.
  namespace buffered {
    .constant global READY: byte = 0x0;
    .constant global WRITE: byte = 0x1;
    .constant global READ: byte = 0x2;
    .constant global PENDING: byte = 0x3;
    .constant global ERROR: byte = 0x4;

    function write(control: * byte, buffer: byte[], data: byte[]): bool {
      len buffer = len data;
      for(var i = 0; i < len data; i = i + 1){
        buffer[i] = data[i];
      }

      *control = WRITE;

      while(*control == PENDING){}

      return *control == READY;
    }

    function read(control: * byte, buffer: byte[], data: byte[]): bool {
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

  // Formatted console IO.
  namespace console {
    function print(s: byte[]): bool {
      var debugOutputControl: *byte = <unsafe * byte> 0x303;
      var debugOutputBuffer: byte[] = <unsafe byte[]> 0x304;
      return buffered::write(debugOutputControl, debugOutputBuffer, s);
    }

    function input(s: byte[]): bool {
      var debugInputControl = <unsafe * byte> 0x403;
      var debugInputBuffer = <unsafe byte[]> 0x404;
      return buffered::read(debugInputControl, debugInputBuffer, s);
    }
  }
}
