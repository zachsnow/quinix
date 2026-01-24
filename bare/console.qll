// Bare-metal console using direct peripheral I/O.
// DebugOutputPeripheral (0x3) is at base 0x300.
// DebugInputPeripheral (0x4) is at base 0x400.
namespace std::console {
  function print(s: string): bool {
    var control: *byte = <unsafe *byte>0x300;
    var size: *byte = <unsafe *byte>0x302;
    var buffer: *byte = <unsafe *byte>0x303;
    return std::buffered::write(control, size, buffer, s);
  }

  function input(buffer: string): bool {
    var control: *byte = <unsafe *byte>0x400;
    var size: *byte = <unsafe *byte>0x402;
    var buf: *byte = <unsafe *byte>0x403;
    return std::buffered::read(control, size, buf, buffer);
  }
}
