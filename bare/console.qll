// Bare-metal console using direct peripheral I/O.
// DebugOutputPeripheral (0x3) is at base 0x303.
// DebugInputPeripheral (0x4) is at base 0x403.
namespace std::console {
  function print(s: string): bool {
    var control: *byte = <unsafe *byte>0x303;
    var size: *byte = <unsafe *byte>0x305;
    var buffer: *byte = <unsafe *byte>0x306;
    return std::buffered::write(control, size, buffer, s);
  }

  // Read input into buffer.
  // Returns: number of bytes read, or -1 on error.
  function input(buffer: string): byte {
    var control: *byte = <unsafe *byte>0x403;
    var size: *byte = <unsafe *byte>0x405;
    var buf: *byte = <unsafe *byte>0x406;
    return std::buffered::read(control, size, buf, buffer);
  }
}
