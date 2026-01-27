.constant global debugFileControl: *byte = <unsafe * byte> 0x503;
.constant global debugFileSize: *byte = <unsafe * byte> 0x504;
.constant global debugFileBuffer: *byte = <unsafe * byte> 0x505;

function main(): byte {
  var buffer: byte[0x100];
  std::console::print("Enter filename: ");
  var input_len = std::console::input(buffer);
  if (input_len == -1) {
    return -1;
  }
  len buffer = input_len;

  if(!std::buffered::write(debugFileControl, debugFileSize, debugFileBuffer, buffer)){
    return -1;
  }

  var read_len = std::buffered::read(debugFileControl, debugFileSize, debugFileBuffer, buffer);
  if (read_len == -1) {
    return -1;
  }
  len buffer = read_len;

  std::console::print(buffer);
  return 0;
}
