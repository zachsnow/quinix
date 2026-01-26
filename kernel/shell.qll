// Simple interactive shell for the kernel.
namespace shell {
  // Current working directory path.
  // QFS only has a flat root directory for now.
  global cwd: byte[64] = [0; 64];
  global cwd_len: byte = 1;

  function _init_cwd(): void {
    cwd[0] = 47;  // "/"
    cwd_len = 1;
  }

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

  // Print a string with known length.
  function _print_n(s: byte[], s_len: byte): void {
    for (var i = 0; i < s_len; i = i + 1) {
      var c: byte[1];
      c[0] = s[i];
      std::console::print(c);
    }
  }

  // Print a number in decimal.
  function _print_num(n: byte): void {
    var buf: byte[12];
    var i: byte = 0;

    if (n == 0) {
      std::console::print("0");
      return;
    }

    // Build digits in reverse.
    while (n > 0) {
      buf[i] = 48 + (n % 10);  // "0" + digit
      n = n / 10;
      i = i + 1;
    }

    // Print in correct order.
    while (i > 0) {
      i = i - 1;
      var c: byte[1];
      c[0] = buf[i];
      std::console::print(c);
    }
  }

  function cmd_help(): void {
    std::console::print("Commands: help, pwd, ls, cat, echo, exit\n");
  }

  function cmd_pwd(): void {
    _print_n(cwd, cwd_len);
    std::console::print("\n");
  }

  function cmd_ls(): void {
    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("ls: filesystem not available\n");
        return;
      }
    }

    var entry: kernel::fs::qfs::dirent;
    var found: byte = 0;

    for (var idx: byte = 0; idx < kernel::fs::qfs::MAX_DIR_ENTRIES; idx = idx + 1) {
      if (!kernel::fs::qfs::_read_dirent(idx, &entry)) {
        break;
      }

      if (entry.flags == kernel::fs::qfs::DIRENT_USED) {
        // Print filename.
        for (var n: byte = 0; n < 8; n = n + 1) {
          if (entry.name[n] == 0) {
            break;
          }
          var c: byte[1];
          c[0] = entry.name[n];
          std::console::print(c);
        }

        // Print extension if present.
        if (entry.extension[0] != 0) {
          std::console::print(".");
          for (var e: byte = 0; e < 4; e = e + 1) {
            if (entry.extension[e] == 0) {
              break;
            }
            var ch: byte[1];
            ch[0] = entry.extension[e];
            std::console::print(ch);
          }
        }

        // Print size.
        std::console::print("  ");
        _print_num(entry.size);
        std::console::print(" bytes\n");

        found = found + 1;
      }
    }

    if (found == 0) {
      std::console::print("(empty)\n");
    }
  }

  function cmd_cat(args: byte[], args_len: byte): void {
    if (args_len == 0) {
      std::console::print("cat: missing filename\n");
      return;
    }

    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("cat: filesystem not available\n");
        return;
      }
    }

    // Create a dynamic array from args for file_open.
    var path: byte[] = new byte[64];
    for (var p: byte = 0; p < args_len && p < 63; p = p + 1) {
      path[p] = args[p];
    }
    len path = args_len;

    var slot = kernel::fs::qfs::file_open(path, kernel::fs::qfs::MODE_READ);
    if (slot == -1) {
      std::console::print("cat: file not found: ");
      _print_n(args, args_len);
      std::console::print("\n");
      delete path;
      return;
    }

    // Read and print file contents.
    var buf: byte[128];
    var bytes_read = kernel::fs::qfs::file_read(slot, &buf[0], 128);
    while (bytes_read > 0) {
      for (var q: byte = 0; q < bytes_read; q = q + 1) {
        var c: byte[1];
        c[0] = buf[q];
        std::console::print(c);
      }
      bytes_read = kernel::fs::qfs::file_read(slot, &buf[0], 128);
    }

    kernel::fs::qfs::file_close(slot);
    delete path;
    std::console::print("\n");
  }

  function cmd_echo(args: byte[], args_len: byte): void {
    _print_n(args, args_len);
    std::console::print("\n");
  }

  function cmd_exit(): void {
    std::console::print("Goodbye.\n");
    kernel::support::halt(0);
  }

  function main(): void {
    _init_cwd();

    std::console::print("Quinix Shell v0.0.1\n");

    // Try to initialize filesystem.
    if (kernel::fs::qfs::init()) {
      std::console::print("Filesystem mounted.\n");
    } else {
      std::console::print("No filesystem available.\n");
    }

    var line: byte[0x100];

    while (true) {
      std::console::print("$ ");

      if (!std::console::input(line)) {
        std::console::print("input error\n");
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
        if (str_eq_n("help", cmd, cmd_len)) {
          cmd_help();
        } else if (str_eq_n("pwd", cmd, cmd_len)) {
          cmd_pwd();
        } else if (str_eq_n("ls", cmd, cmd_len)) {
          cmd_ls();
        } else if (str_eq_n("cat", cmd, cmd_len)) {
          cmd_cat(args, args_len);
        } else if (str_eq_n("echo", cmd, cmd_len)) {
          cmd_echo(args, args_len);
        } else if (str_eq_n("exit", cmd, cmd_len)) {
          cmd_exit();
        } else {
          _print_n(cmd, cmd_len);
          std::console::print(": unknown command\n");
        }
      }
    }
  }
}
