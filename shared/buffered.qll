// Buffered I/O utilities for memory-mapped peripherals.
// Layout: base+0=control, base+1=capacity, base+2=size, base+3+=buffer
namespace std::buffered {
  .constant global READY: byte = 0x0;
  .constant global WRITE: byte = 0x1;
  .constant global READ: byte = 0x2;
  .constant global PENDING: byte = 0x3;
  .constant global ERROR: byte = 0x4;

  function write(control: *byte, size: *byte, buffer: *byte, data: string): bool {
    *size = len data;
    for (var i = 0; i < len data; i = i + 1) {
      buffer[unsafe i] = data[i];
    }

    *control = WRITE;

    while (*control == PENDING) {}

    return *control == READY;
  }

  function read_size(control: *byte, size: *byte): byte {
    return *size;
  }

  // Read from a buffered peripheral.
  // Returns: number of bytes read, or -1 on error.
  // Note: The caller must set `len data` based on the return value.
  function read(control: *byte, size: *byte, buffer: *byte, data: byte[]): byte {
    *control = READ;

    while (*control == PENDING) {}

    if (*control != READY) {
      return -1;
    }

    var read_size = *size;
    if (read_size > cap data) {
      read_size = cap data;
    }

    for (var i: byte = 0; i < read_size; i = i + 1) {
      data[i] = buffer[unsafe i];
    }

    return read_size;
  }
}
