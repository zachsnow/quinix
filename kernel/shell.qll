// Simple interactive shell for the kernel.
namespace shell {
  // Current working directory path.
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

  // Terminal color helpers.
  function _reset(): void { std::console::print("\x1b[0m"); }
  function _bold(): void { std::console::print("\x1b[1m"); }
  function _blue(): void { std::console::print("\x1b[34m"); }

  // Build absolute path from relative path and cwd.
  function _make_absolute(args: byte[], args_len: byte, out: byte[]): byte {
    // If already absolute, just copy.
    if (args_len > 0 && args[0] == 47) {  // starts with "/"
      for (var i: byte = 0; i < args_len && i < cap out; i = i + 1) {
        out[i] = args[i];
      }
      return args_len;
    }

    // Copy cwd first.
    var out_len: byte = 0;
    for (var j: byte = 0; j < cwd_len && out_len < cap out; j = j + 1) {
      out[out_len] = cwd[j];
      out_len = out_len + 1;
    }

    // Add separator if cwd doesn't end with '/'.
    if (cwd_len > 0 && cwd[cwd_len - 1] != 47 && out_len < cap out) {
      out[out_len] = 47;
      out_len = out_len + 1;
    }

    // Append relative path.
    for (var k: byte = 0; k < args_len && out_len < cap out; k = k + 1) {
      out[out_len] = args[k];
      out_len = out_len + 1;
    }

    return out_len;
  }

  function cmd_help(): void {
    std::console::print("Commands: help, pwd, cd, ls, cat, touch, rm, mkdir, run, verbose, exit\n");
  }

  function cmd_pwd(): void {
    _print_n(cwd, cwd_len);
    std::console::print("\n");
  }

  function cmd_cd(args: byte[], args_len: byte): void {
    // No args means go to root.
    if (args_len == 0) {
      cwd[0] = 47;  // "/"
      cwd_len = 1;
      return;
    }

    // Check if filesystem is initialized.
    if (!kernel::fs::qfs::initialized) {
      if (!kernel::fs::qfs::init()) {
        std::console::print("cd: filesystem not available\n");
        return;
      }
    }

    // Resolve the path.
    len args = args_len;
    var result: kernel::fs::qfs::path_result;
    if (!kernel::fs::qfs::resolve_path(args, &result)) {
      std::console::print("cd: not found: ");
      _print_n(args, args_len);
      std::console::print("\n");
      return;
    }

    // Must be a directory.
    if ((result.entry.flags & kernel::fs::qfs::DIRENT_DIRECTORY) == 0) {
      std::console::print("cd: not a directory: ");
      _print_n(args, args_len);
      std::console::print("\n");
      return;
    }

    // Update cwd. Handle absolute vs relative paths.
    if (args[0] == 47) {  // starts with "/"
      // Absolute path - copy directly.
      for (var i: byte = 0; i < args_len && i < cap cwd; i = i + 1) {
        cwd[i] = args[i];
      }
      cwd_len = args_len;
    } else {
      // Relative path - append to cwd.
      // Add "/" separator if cwd doesn't end with one.
      var new_len = cwd_len;
      if (cwd_len > 0 && cwd[cwd_len - 1] != 47) {
        if (new_len < cap cwd) {
          cwd[new_len] = 47;
          new_len = new_len + 1;
        }
      }
      // Append the path.
      for (var j: byte = 0; j < args_len && new_len < cap cwd; j = j + 1) {
        cwd[new_len] = args[j];
        new_len = new_len + 1;
      }
      cwd_len = new_len;
    }
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
          // Print type indicator and set color.
          if ((entry.flags & kernel::fs::qfs::DIRENT_DIRECTORY) != 0) {
            _blue();
            std::console::print("d ");
            _bold();
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

          // Reset color if directory.
          if ((entry.flags & kernel::fs::qfs::DIRENT_DIRECTORY) != 0) {
            _reset();
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

    // Use cwd if no path given.
    var path: byte[];
    var path_len: byte;
    if (args_len == 0) {
      path = cwd;
      path_len = cwd_len;
    } else {
      path = args;
      path_len = args_len;
    }

    // Resolve the path.
    len path = path_len;
    var result: kernel::fs::qfs::path_result;
    if (!kernel::fs::qfs::resolve_path(path, &result)) {
      std::console::print("ls: not found: ");
      _print_n(path, path_len);
      std::console::print("\n");
      return;
    }

    // Must be a directory.
    if ((result.entry.flags & kernel::fs::qfs::DIRENT_DIRECTORY) == 0) {
      std::console::print("ls: not a directory: ");
      _print_n(path, path_len);
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

    // Build absolute path.
    var abs_path: byte[64];
    var abs_len = _make_absolute(args, args_len, abs_path);

    // Create dynamic array for resolve_path.
    var path: byte[] = new byte[64];
    for (var i: byte = 0; i < abs_len; i = i + 1) {
      path[i] = abs_path[i];
    }
    len path = abs_len;

    // Check if file already exists using path resolution.
    var result: kernel::fs::qfs::path_result;
    if (kernel::fs::qfs::resolve_path(path, &result)) {
      // File already exists - nothing to do.
      delete path;
      return;
    }

    // Resolve parent directory and create file.
    var filename: byte[24] = [0; 24];
    var filename_len: byte = 0;
    var parent_sector = kernel::fs::qfs::resolve_parent(path, &filename[0], &filename_len);
    if (parent_sector == 0 || filename_len == 0) {
      std::console::print("touch: invalid path\n");
      delete path;
      return;
    }

    // Create empty file.
    var dr: kernel::fs::qfs::dir_result;
    if (!kernel::fs::qfs::dir_create_in(parent_sector, filename[0:filename_len], 0, 0, kernel::fs::qfs::DIRENT_USED, &dr)) {
      std::console::print("touch: failed to create file\n");
    }
    delete path;
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

    // Build absolute path.
    var abs_path: byte[64];
    var abs_len = _make_absolute(args, args_len, abs_path);

    // Create dynamic array for resolve_path.
    var path: byte[] = new byte[64];
    for (var i: byte = 0; i < abs_len; i = i + 1) {
      path[i] = abs_path[i];
    }
    len path = abs_len;

    // Find the file using path resolution.
    var result: kernel::fs::qfs::path_result;
    if (!kernel::fs::qfs::resolve_path(path, &result)) {
      std::console::print("rm: not found: ");
      _print_n(args, args_len);
      std::console::print("\n");
      delete path;
      return;
    }

    // Delete the file at (sector, slot).
    if (!kernel::fs::qfs::dir_delete_at(result.dir_result.sector, result.dir_result.slot)) {
      std::console::print("rm: failed to delete\n");
    }
    delete path;
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

    // Build absolute path.
    var abs_path: byte[64];
    var abs_len = _make_absolute(args, args_len, abs_path);

    // Create dynamic array for mkdir.
    var path: byte[] = new byte[64];
    for (var i: byte = 0; i < abs_len; i = i + 1) {
      path[i] = abs_path[i];
    }
    len path = abs_len;

    var sector = kernel::fs::qfs::mkdir(path);
    if (sector == 0) {
      std::console::print("mkdir: failed to create directory\n");
    }
    delete path;
  }

  function cmd_run(args: byte[], args_len: byte): void {
    if (args_len == 0) {
      std::console::print("run: missing program path\n");
      return;
    }

    // Find the first space to split path from program args.
    var path_end: byte = args_len;
    for (var j: byte = 0; j < args_len; j = j + 1) {
      if (args[j] == 32) {  // space character
        path_end = j;
        break;
      }
    }

    // Extract just the path portion for _make_absolute.
    var raw_path: byte[64];
    for (var k: byte = 0; k < path_end && k < 64; k = k + 1) {
      raw_path[k] = args[k];
    }

    // Build absolute path.
    var abs_path: byte[64];
    var abs_len = _make_absolute(raw_path, path_end, abs_path);

    // Create dynamic array for load_executable.
    var path: byte[] = new byte[64];
    for (var i: byte = 0; i < abs_len; i = i + 1) {
      path[i] = abs_path[i];
    }
    len path = abs_len;

    // Extract program args (everything after the first space).
    var prog_args: byte[128];
    var prog_args_len: byte = 0;
    var prog_args_start = path_end + 1;
    if (prog_args_start < args_len) {
      for (var m: byte = prog_args_start; m < args_len && prog_args_len < 128; m = m + 1) {
        prog_args[prog_args_len] = args[m];
        prog_args_len = prog_args_len + 1;
      }
    }

    // Debug: print args info
    std::console::print("run: args_len=");
    _print_num(prog_args_len);
    std::console::print(" args='");
    _print_n(prog_args, prog_args_len);
    std::console::print("'\n");

    var pid = load_executable(path, 0, prog_args, prog_args_len);
    delete path;
    if (pid == 0) {
      std::console::print("run: failed to load program\n");
      return;
    }
    wait_for_process(pid);
    std::console::print("\n");
  }

  function cmd_verbose(args: byte[], args_len: byte): void {
    if (str_eq_n("on", args, args_len)) {
      kernel::verbose = true;
      std::console::print("Verbose mode on.\n");
    } else if (str_eq_n("off", args, args_len)) {
      kernel::verbose = false;
      std::console::print("Verbose mode off.\n");
    } else if (args_len == 0) {
      kernel::verbose = !kernel::verbose;
      if (kernel::verbose) {
        std::console::print("Verbose mode on.\n");
      } else {
        std::console::print("Verbose mode off.\n");
      }
    } else {
      std::console::print("Usage: verbose [on|off]\n");
    }
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

    kernel::verbose = false;

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
        } else if (str_eq_n("cd", cmd, cmd_len)) {
          cmd_cd(args, args_len);
        } else if (str_eq_n("ls", cmd, cmd_len)) {
          cmd_ls(args, args_len);
        } else if (str_eq_n("cat", cmd, cmd_len)) {
          cmd_cat(args, args_len);
        } else if (str_eq_n("touch", cmd, cmd_len)) {
          cmd_touch(args, args_len);
        } else if (str_eq_n("rm", cmd, cmd_len)) {
          cmd_rm(args, args_len);
        } else if (str_eq_n("mkdir", cmd, cmd_len)) {
          cmd_mkdir(args, args_len);
        } else if (str_eq_n("run", cmd, cmd_len)) {
          cmd_run(args, args_len);
        } else if (str_eq_n("verbose", cmd, cmd_len)) {
          cmd_verbose(args, args_len);
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
