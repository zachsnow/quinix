// cat - concatenate and print files
// Usage: run bin/cat, then enter filename when prompted

function main(): byte {
  var filename_buf: byte[64];
  var filename: byte[] = filename_buf[0:64];

  lib::print("File: ");
  var n = lib::input(filename);
  if (n <= 0) {
    lib::print("Error reading filename\n");
    return 1;
  }
  len filename = n;

  var handle = lib::open(filename);
  if (<byte>handle == -1) {
    lib::print("Error: file not found\n");
    return 1;
  }

  var buffer_storage: byte[256];
  var buffer: byte[] = buffer_storage[0:256];
  var bytes_read = lib::read(handle, buffer);
  while (bytes_read > 0) {
    len buffer = bytes_read;
    lib::print(buffer);
    len buffer = 256;
    bytes_read = lib::read(handle, buffer);
  }

  lib::close(handle);
  return 0;
}
