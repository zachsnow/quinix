// The shell is just a user-space program.
using global::std::fmt;

function exec(arguments: string[]): void {
  if(len arguments < 1){
    print('exec: no arguments');
    return;
  }

  var program = arguments[0];

  lib::spawn(binary);
}

function main(): void {
  print('Quinix Shell v0.0.1\n');
  while(true){
    print('$ ');

    var command = read_command();
    var parsed = parse_command(command);

    var fn = find_command(parsed.command);
    if(!fn){
      print([
        fs(parsed.command),
        fs(': unknown command\n'),
      ]);
    }
    else {
      fn(parsed.arguments);
    }
  }
}