// Test program: echo arguments back
function main(args: string): byte {
  if (len args == 0) {
    lib::print("(no args)\n");
  } else {
    lib::print(args);
    lib::print("\n");
  }
  return 0;
}
