// Bare-metal console using direct peripheral I/O.
// DebugOutputPeripheral (0x3) is at base 0x302.
// DebugInputPeripheral (0x4) is at base 0x402.
namespace std::console {
  function print(s: string): bool {
    var control: *byte = <unsafe *byte>0x302;
    var size: *byte = <unsafe *byte>0x304;
    var buffer: *byte = <unsafe *byte>0x305;
    return std::buffered::write(control, size, buffer, s);
  }

  // Read input into buffer.
  // Returns: number of bytes read, or -1 on error.
  function input(buffer: string): byte {
    var control: *byte = <unsafe *byte>0x402;
    var size: *byte = <unsafe *byte>0x404;
    var buf: *byte = <unsafe *byte>0x405;
    return std::buffered::read(control, size, buf, buffer);
  }
}
