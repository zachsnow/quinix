namespace io {
  type format_type = byte;
  namespace format_type {
    .constant global S: format_type = 1;
    .constant global U: format_type = 2;
    .constant global I: format_type = 3;
    .constant global P: format_type = 4;
  }

  type format = struct {
    format_type: format_type;
    n: byte;
    base: byte;
    s: byte[];
    p: * byte;
  };

  function fs(s: byte[]): format {
    return format {
      format_type = format_type::S,
      s = s,
    };
  }
  function fi(n: byte): format {
    return format {
      format_type = format_type::I,
      n = n,
    };
  }
  function fu(n: byte): format {
    return format {
      format_type = format_type::U,
      n = n,
    };
  }
  function fp(n: * byte): format {
    return format {
      format_type = format_type::P,
      p = p,
    };
  }

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

  function printf(formats: format[]): bool {
    var buffer: byte[32];

    for(var i = 0; i < len formats; i = i + 1){
      var f = formats[i];
      if(f.format_type == format_type::U){
        if(!utoa(f.n, buffer, f.base || 10)){
          return false;
        }
        print(buffer);
      }
      else if(f.format_type == format_type::I){
        if(!itoa(f.n, buffer, f.base || 0)){
          return false;
        }
        print(buffer);
      }
      else if(f.f == F_P){
        if(!utoa(f.p, buffer, f.base || 16)){
          return false;
        }
        print(buffer);
      }
      else if(f.format_type == format_type::S){
        print(f.s);
      }
      else {
        return false;
      }
    }
  }

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
