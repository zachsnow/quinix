// echo - read a line and print it back

function main(): byte {
  var buffer_storage: byte[256];
  var buffer: byte[] = buffer_storage[0:256];

  lib::print("Say something: ");
  var n = lib::input(buffer);
  if (n <= 0) {
    return 1;
  }
  len buffer = n;

  lib::print("You said: ");
  lib::print(buffer);
  lib::print("\n");
  return 0;
}
