function main(): byte {
  var buffer: byte[0x100];
  std::console::print('Say something! ');
  if(!std::console::input(buffer)){
    return -1;
  }
  std::console::print(buffer);
  std::console::print('\n');
  return 0;
}
