///////////////////////////////////////////////////////////////////////
// Block device driver.
///////////////////////////////////////////////////////////////////////
namespace kernel {
  namespace block {
    // Block device peripheral identifier.
    .constant global identifier: byte = 0x20;

    // Shared region layout offsets.
    .constant global OFFSET_STATUS: byte = 0x0;
    .constant global OFFSET_LBA: byte = 0x1;
    .constant global OFFSET_COUNT: byte = 0x2;
    .constant global OFFSET_BUFFER_PTR: byte = 0x3;
    .constant global OFFSET_TOTAL_SECTORS: byte = 0x4;
    .constant global OFFSET_SECTOR_SIZE: byte = 0x5;
    .constant global OFFSET_ERROR_CODE: byte = 0x6;
    .constant global SHARED_SIZE: byte = 0x7;

    // Commands (written to IO region).
    .constant global CMD_NOP: byte = 0x0;
    .constant global CMD_READ: byte = 0x1;
    .constant global CMD_WRITE: byte = 0x2;
    .constant global CMD_FLUSH: byte = 0x3;

    // Status values.
    .constant global STATUS_READY: byte = 0x0;
    .constant global STATUS_BUSY: byte = 0x1;
    .constant global STATUS_ERROR: byte = 0xFF;

    // Error codes.
    .constant global ERR_NONE: byte = 0x0;
    .constant global ERR_INVALID_LBA: byte = 0x1;
    .constant global ERR_INVALID_COUNT: byte = 0x2;
    .constant global ERR_IO_ERROR: byte = 0x3;

    // Default sector size in words (128 words = 512 bytes).
    .constant global DEFAULT_SECTOR_SIZE: byte = 128;

    // Peripheral base address (set by init).
    global base: *byte = null;

    // Cached values.
    global total_sectors: byte = 0;
    global sector_size: byte = 0;

    function init(entry: *peripherals::peripheral_table_entry): void {
      base = entry->address;
      total_sectors = base[unsafe OFFSET_TOTAL_SECTORS];
      sector_size = base[unsafe OFFSET_SECTOR_SIZE];
    }

    function _wait(): bool {
      while (base[unsafe OFFSET_STATUS] == STATUS_BUSY) {}
      return base[unsafe OFFSET_STATUS] == STATUS_READY;
    }

    function _command(cmd: byte): void {
      // IO region is at base + SHARED_SIZE.
      var io = &base[unsafe SHARED_SIZE];
      *io = cmd;
    }

    // Read a single sector into buffer.
    // Buffer must have capacity >= sector_size words.
    function read_sector(lba: byte, buffer: *byte): bool {
      base[unsafe OFFSET_LBA] = lba;
      base[unsafe OFFSET_COUNT] = 1;
      base[unsafe OFFSET_BUFFER_PTR] = <unsafe byte>buffer;
      _command(CMD_READ);
      return _wait();
    }

    // Write a single sector from buffer.
    // Buffer must have at least sector_size words.
    function write_sector(lba: byte, buffer: *byte): bool {
      base[unsafe OFFSET_LBA] = lba;
      base[unsafe OFFSET_COUNT] = 1;
      base[unsafe OFFSET_BUFFER_PTR] = <unsafe byte>buffer;
      _command(CMD_WRITE);
      return _wait();
    }

    // Read multiple sectors into buffer.
    // Buffer must have capacity >= count * sector_size words.
    function read_sectors(lba: byte, count: byte, buffer: *byte): bool {
      base[unsafe OFFSET_LBA] = lba;
      base[unsafe OFFSET_COUNT] = count;
      base[unsafe OFFSET_BUFFER_PTR] = <unsafe byte>buffer;
      _command(CMD_READ);
      return _wait();
    }

    // Write multiple sectors from buffer.
    // Buffer must have at least count * sector_size words.
    function write_sectors(lba: byte, count: byte, buffer: *byte): bool {
      base[unsafe OFFSET_LBA] = lba;
      base[unsafe OFFSET_COUNT] = count;
      base[unsafe OFFSET_BUFFER_PTR] = <unsafe byte>buffer;
      _command(CMD_WRITE);
      return _wait();
    }

    // Flush pending writes to storage.
    function flush(): bool {
      _command(CMD_FLUSH);
      return _wait();
    }

    // Get total number of sectors on device.
    function get_total_sectors(): byte {
      return total_sectors;
    }

    // Get sector size in words.
    function get_sector_size(): byte {
      return sector_size;
    }

    // Get last error code.
    function get_error(): byte {
      return base[unsafe OFFSET_ERROR_CODE];
    }
  }
}
