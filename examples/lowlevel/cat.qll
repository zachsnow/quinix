.constant global debugFileControl: *byte = <unsafe * byte> 0x503;
.constant global debugFileBuffer: byte[] = <unsafe byte[]> 0x504;

function main(): byte {
  var buffer: byte[0x100];
  std::console::print("Enter filename: ");
  if(!std::console::input(buffer)){
    return -1;
  }

  if(!std::buffered::write(debugFileControl, debugFileBuffer, buffer)){
    return -1;
  }

  if(!std::buffered::read(debugFileControl, debugFileBuffer, buffer)){
    return -1;
  }

  std::console::print(buffer);
  return 0;
}
