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
    std::console::print("Commands: help, pwd, ls, cat, mkdir, touch, rm, run, exit\n");
  }

  function cmd_pwd(): void {
    _print_n(cwd, cwd_len);
    std::console::print("\n");
  }

  // List entries in a directory sector, following FAT chain.
  function _ls_dir(dir_sector: byte): void {
    var entry: kernel::fs::qfs::dirent;
    var found: byte = 0;
    var sector = dir_sector;

    while (sector != kernel::fs::qfs::FAT_END &&
           sector != kernel::fs::qfs::FAT_FREE &&
           sector != 0) {
      for (var slot: byte = 0; slot < kernel::fs::qfs::DIRENT_PER_SECTOR; slot = slot + 1) {
        if (!kernel::fs::qfs::_read_dirent_at(sector, slot, &entry)) {
          continue;
        }

        if ((entry.flags & kernel::fs::qfs::DIRENT_USED) != 0 &&
            (entry.flags & kernel::fs::qfs::DIRENT_DELETED) == 0) {
          // Print type indicator.
          if ((entry.flags & kernel::fs::qfs::DIRENT_DIRECTORY) != 0) {
            std::console::print("d ");
          } else {
            std::console::print("- ");
          }

          // Print filename (up to 24 chars).
          for (var n: byte = 0; n < 24; n = n + 1) {
            if (entry.name[n] == 0) {
              break;
            }
            var c: byte[1];
            c[0] = entry.name[n];
            std::console::print(c);
          }

          // Print size.
          std::console::print("  ");
          _print_num(entry.size);
          std::console::print(" bytes\n");

          found = found + 1;
        }
      }
      sector = kernel::fs::qfs::fat_read(sector);
    }

    if (found == 0) {
      std::console::print("(empty)\n");
    }
  }

  function cmd_ls(args: byte[], args_len: byte): void {
    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("ls: filesystem not available\n");
        return;
      }
    }

    // Default to root if no path given.
    if (args_len == 0) {
      _ls_dir(kernel::fs::qfs::sb.root_start);
      return;
    }

    // Resolve the path.
    len args = args_len;
    var result: kernel::fs::qfs::path_result;
    if (!kernel::fs::qfs::resolve_path(args, &result)) {
      std::console::print("ls: not found: ");
      _print_n(args, args_len);
      std::console::print("\n");
      return;
    }

    // Must be a directory.
    if ((result.entry.flags & kernel::fs::qfs::DIRENT_DIRECTORY) == 0) {
      std::console::print("ls: not a directory: ");
      _print_n(args, args_len);
      std::console::print("\n");
      return;
    }

    _ls_dir(result.entry.first_sector);
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

  function cmd_touch(args: byte[], args_len: byte): void {
    if (args_len == 0) {
      std::console::print("touch: missing filename\n");
      return;
    }

    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("touch: filesystem not available\n");
        return;
      }
    }

    // Check if file already exists using path resolution.
    len args = args_len;
    var result: kernel::fs::qfs::path_result;
    if (kernel::fs::qfs::resolve_path(args, &result)) {
      // File already exists - nothing to do.
      return;
    }

    // Resolve parent directory and create file.
    var filename: byte[24] = [0; 24];
    var filename_len: byte = 0;
    var parent_sector = kernel::fs::qfs::resolve_parent(args, &filename[0], &filename_len);
    if (parent_sector == 0 || filename_len == 0) {
      std::console::print("touch: invalid path\n");
      return;
    }

    // Create empty file.
    var dr: kernel::fs::qfs::dir_result;
    if (!kernel::fs::qfs::dir_create_in(parent_sector, filename[0:filename_len], 0, 0, kernel::fs::qfs::DIRENT_USED, &dr)) {
      std::console::print("touch: failed to create file\n");
    }
  }

  function cmd_rm(args: byte[], args_len: byte): void {
    if (args_len == 0) {
      std::console::print("rm: missing filename\n");
      return;
    }

    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("rm: filesystem not available\n");
        return;
      }
    }

    // Find the file using path resolution.
    len args = args_len;
    var result: kernel::fs::qfs::path_result;
    if (!kernel::fs::qfs::resolve_path(args, &result)) {
      std::console::print("rm: not found: ");
      _print_n(args, args_len);
      std::console::print("\n");
      return;
    }

    // Delete the file at (sector, slot).
    if (!kernel::fs::qfs::dir_delete_at(result.dir_result.sector, result.dir_result.slot)) {
      std::console::print("rm: failed to delete\n");
    }
  }

  function cmd_mkdir(args: byte[], args_len: byte): void {
    if (args_len == 0) {
      std::console::print("mkdir: missing directory name\n");
      return;
    }

    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("mkdir: filesystem not available\n");
        return;
      }
    }

    len args = args_len;
    var sector = kernel::fs::qfs::mkdir(args);
    if (sector == 0) {
      std::console::print("mkdir: failed to create directory\n");
    }
  }

  function cmd_run(args: byte[], args_len: byte): void {
    if (args_len == 0) {
      std::console::print("run: missing program path\n");
      return;
    }
    len args = args_len;
    var pid = load_executable(args, 0);
    if (pid == 0) {
      std::console::print("run: failed to load program\n");
      return;
    }
    wait_for_process(pid);
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

      var input_len = std::console::input(line);
      if (input_len == -1) {
        std::console::print("input error\n");
      } else if (input_len == 0) {
        // Empty line, do nothing
      } else {
        var line_len: byte = input_len;

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
          cmd_ls(args, args_len);
        } else if (str_eq_n("cat", cmd, cmd_len)) {
          cmd_cat(args, args_len);
        } else if (str_eq_n("mkdir", cmd, cmd_len)) {
          cmd_mkdir(args, args_len);
        } else if (str_eq_n("touch", cmd, cmd_len)) {
          cmd_touch(args, args_len);
        } else if (str_eq_n("rm", cmd, cmd_len)) {
          cmd_rm(args, args_len);
        } else if (str_eq_n("run", cmd, cmd_len)) {
          cmd_run(args, args_len);
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
