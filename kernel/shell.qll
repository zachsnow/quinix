// Simple interactive shell for the kernel.
namespace shell {
  function str_eq(a: string, b: string): bool {
    if (len a != len b) {
      return false;
    }
    for (var i = 0; i < len a; i = i + 1) {
      if (a[i] != b[i]) {
        return false;
      }
    }
    return true;
  }

  function str_eq_n(a: string, b: byte[], b_len: byte): bool {
    if (len a != b_len) {
      return false;
    }
    for (var i = 0; i < len a; i = i + 1) {
      if (a[i] != b[i]) {
        return false;
      }
    }
    return true;
  }

  function cmd_help(): void {
    std::console::print('Commands: help, echo, exit\n');
  }

  function cmd_echo(args: byte[], args_len: byte): void {
    for (var i = 0; i < args_len; i = i + 1) {
      var c: byte[1];
      c[0] = args[i];
      std::console::print(c);
    }
    std::console::print('\n');
  }

  function cmd_exit(): void {
    std::console::print('Goodbye.\n');
    kernel::support::halt(0);
  }

  function main(): void {
    std::console::print('Quinix Shell v0.0.1\n');

    var line: byte[0x100];

    while (true) {
      std::console::print('$ ');

      if (!std::console::input(line)) {
        std::console::print('input error\n');
      } else if (len line == 0) {
        // Empty line, do nothing
      } else {
        var line_len = len line;

        // Find the first space to split command from args.
        var cmd_end: byte = line_len;
        for (var i = 0; i < line_len; i = i + 1) {
          if (line[i] == 32) {  // space character
            cmd_end = i;
            break;
          }
        }

        // Extract command.
        var cmd: byte[0x20];
        var cmd_len: byte = 0;
        for (var j = 0; j < cmd_end && j < cap cmd; j = j + 1) {
          cmd[j] = line[j];
          cmd_len = cmd_len + 1;
        }

        // Extract args (everything after the space).
        var args: byte[0x100];
        var args_len: byte = 0;
        var args_start = cmd_end + 1;
        if (args_start < line_len) {
          for (var k = args_start; k < line_len; k = k + 1) {
            args[k - args_start] = line[k];
            args_len = args_len + 1;
          }
        }

        // Dispatch commands.
        if (str_eq_n('help', cmd, cmd_len)) {
          cmd_help();
        } else if (str_eq_n('echo', cmd, cmd_len)) {
          cmd_echo(args, args_len);
        } else if (str_eq_n('exit', cmd, cmd_len)) {
          cmd_exit();
        } else {
          for (var m = 0; m < cmd_len; m = m + 1) {
            var c: byte[1];
            c[0] = cmd[m];
            std::console::print(c);
          }
          std::console::print(': unknown command\n');
        }
      }
    }
  }
}
