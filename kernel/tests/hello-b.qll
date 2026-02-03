// Test program B - prints B repeatedly
function main(args: string): byte {
  for(var i = 0; i < 100; i = i + 1){
    lib::print("B");
  }
  return 0;
}
