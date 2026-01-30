namespace kernel {
  namespace syscall {
    .constant global EXIT: byte = 0x0;
    .constant global READ: byte = 0x1;
    .constant global WRITE: byte = 0x2;
    .constant global OPEN: byte = 0x3;
    .constant global CLOSE: byte = 0x4;
    .constant global CREATE: byte = 0x5;
    .constant global DESTROY: byte = 0x6;
    .constant global SPAWN: byte = 0x7;

    type syscall = struct {
      syscall: byte;
      arg0: byte;
      arg1: byte;
      arg2: byte;
    };

    // Syscall handler function type
    type handler = (syscall) => byte;

    // interrupt 0x80 handler.
    .interrupt function _syscall_interrupt(): void {
      // Arguments are passed in r0...r3.
      var sc = syscall {
        syscall = interrupts::state->registers[0],
        arg0 = interrupts::state->registers[1],
        arg1 = interrupts::state->registers[2],
        arg2 = interrupts::state->registers[3],
      };

      // For now if we make an invalid syscall, we just exit.
      if(sc.syscall < 0 || sc.syscall >= len syscalls){
        log("syscall: invalid");
        _exit(sc);
        return;
      }

      var fn = syscalls[sc.syscall];
      var result = fn(sc);
      // Put result in r0 for return to user
      interrupts::state->registers[0] = result;
    }

    global syscalls: handler[] = [
      _exit,
      _read,
      _write,
      _open,
      _close,
      _create,
      _destroy,
      _spawn,
    ];

    function _translate_pointer<T>(p: * byte): * T {
      var current_process = process::current_process();
      return <unsafe * T>memory::translate(process::get_table(current_process), p);
    }

    // Translate a user virtual address to physical
    function _translate(p: * byte): * byte {
      var current = process::current_process();
      return memory::translate(process::get_table(current), p);
    }

    // Get the data pointer from a user-space slice (translated to physical)
    function _get_slice_data(slice_addr: * byte): * byte {
      var physical_slice = _translate(slice_addr);
      if(!physical_slice){
        return null;
      }
      var data_virt = physical_slice[unsafe 0];  // Virtual address of data
      return _translate(<unsafe * byte>data_virt);
    }

    // Get the length from a user-space slice
    function _get_slice_len(slice_addr: * byte): byte {
      var physical_slice = _translate(slice_addr);
      if(!physical_slice){
        return 0;
      }
      return physical_slice[unsafe 1];  // Length field
    }

    function _validate_pointer(p: * byte): bool {
      return _translate(p) != null;
    }

    function _validate_slice(p: * byte): bool {
      var result = _get_slice_data(p) != null;
      return result;
    }

    function _exit(sc: syscall): byte {
      log("syscall: exit");
      var process = process::current_process();
      process::destroy_process(process);
      return 0;
    }

    function _write(sc: syscall): byte {
      var handle = <fs::handle>sc.arg0;
      var slice_addr = <unsafe * byte>sc.arg1;

      if (!_validate_slice(slice_addr)) {
        log("syscall: write: invalid slice");
        return 0;
      }

      var data_ptr = _get_slice_data(slice_addr);
      var data_len = _get_slice_len(slice_addr);

      // Handle special handles.
      if (handle == fs::handle::OUTPUT) {
        // Write to console output byte by byte.
        for (var i: byte = 0; i < data_len; i = i + 1) {
          var ch = data_ptr[unsafe i];
          fs::write_byte(handle, ch);
        }
        return data_len;
      }

      // Handle QFS file handles.
      if (handle >= 0x10) {
        var qfs_slot = handle - 0x10;
        return fs::qfs::file_write(qfs_slot, data_ptr, data_len);
      }

      return 0;
    }

    function _read(sc: syscall): byte {
      var handle = <fs::handle>sc.arg0;
      var slice_addr = <unsafe * byte>sc.arg1;

      if (!_validate_slice(slice_addr)) {
        return 0;
      }

      var data_ptr = _get_slice_data(slice_addr);
      var data_len = _get_slice_len(slice_addr);

      // Handle special handles.
      if (handle == fs::handle::INPUT) {
        // Read from console input - use existing buffered read.
        var temp_buffer: byte[256];
        var read_limit: byte = data_len > 256 ? 256 : data_len;
        var temp_slice = temp_buffer[0:read_limit];
        var read_count = std::buffered::read(
          &peripherals::debug_input->control,
          &peripherals::debug_input->size,
          &peripherals::debug_input->buffer[unsafe 0],
          temp_slice
        );
        if (read_count == -1) {
          return 0;
        }
        // Copy to user buffer.
        for (var i: byte = 0; i < read_count; i = i + 1) {
          data_ptr[unsafe i] = temp_buffer[i];
        }
        return read_count;
      }

      // Handle QFS file handles.
      // QFS handles start at 0x10 to avoid collision with special handles.
      if (handle >= 0x10) {
        var qfs_slot = handle - 0x10;
        return fs::qfs::file_read(qfs_slot, data_ptr, data_len);
      }

      return 0;
    }

    // Translate a user-space string to kernel-space and copy it.
    // Returns false if the string is invalid.
    function _copy_string(virt_addr: *byte, dest: byte[], max_len: byte): bool {
      var phys = _translate(virt_addr);
      if (!phys) {
        return false;
      }
      var i: byte = 0;
      while (i < max_len) {
        var ch = phys[unsafe i];
        if (ch == 0) {
          break;
        }
        dest[i] = ch;
        i = i + 1;
      }
      len dest = i;
      return true;
    }

    function _open(sc: syscall): byte {
      var path_addr = <unsafe *byte>sc.arg0;
      var mode = sc.arg1;

      // Copy path to kernel buffer.
      var path_buffer: byte[64];
      if (!_copy_string(path_addr, path_buffer, 64)) {
        return -1;
      }

      // Map mode: 0=read, 1=write, 2=append.
      var qfs_mode = fs::qfs::MODE_READ;
      if (mode == 1) {
        qfs_mode = fs::qfs::MODE_WRITE;
      } else if (mode == 2) {
        qfs_mode = fs::qfs::MODE_APPEND;
      }

      // Open file in QFS.
      var slot = fs::qfs::file_open(path_buffer, qfs_mode);
      if (slot == -1) {
        return -1;
      }

      // Return handle (QFS slot + 0x10 to avoid collision with special handles).
      return slot + 0x10;
    }

    function _close(sc: syscall): byte {
      var handle = <fs::handle>sc.arg0;

      // Don"t close special handles.
      if (handle == fs::handle::OUTPUT || handle == fs::handle::INPUT) {
        return 0;
      }

      // Handle QFS file handles.
      if (handle >= 0x10) {
        var qfs_slot = handle - 0x10;
        if (fs::qfs::file_close(qfs_slot)) {
          return 0;
        }
        return -1;
      }

      return 0;
    }

    // Create a new empty file.
    // arg0: pointer to null-terminated path string
    // Returns 0 on success, -1 on failure.
    function _create(sc: syscall): byte {
      var path_addr = <unsafe *byte>sc.arg0;

      // Copy path to kernel buffer.
      var path_buffer: byte[64];
      if (!_copy_string(path_addr, path_buffer, 64)) {
        return -1;
      }

      // Check if file already exists.
      var entry: fs::qfs::dirent;
      var existing = fs::qfs::dir_find(path_buffer, &entry);
      if (existing != -1) {
        // File already exists - success (like touch).
        return 0;
      }

      // Create empty file (no sectors allocated, size 0).
      var index = fs::qfs::dir_create(path_buffer, 0, 0);
      if (index == -1) {
        return -1;
      }

      return 0;
    }

    // Delete a file.
    // arg0: pointer to null-terminated path string
    // Returns 0 on success, -1 on failure.
    function _destroy(sc: syscall): byte {
      var path_addr = <unsafe *byte>sc.arg0;

      // Copy path to kernel buffer.
      var path_buffer: byte[64];
      if (!_copy_string(path_addr, path_buffer, 64)) {
        return -1;
      }

      // Find the file.
      var entry: fs::qfs::dirent;
      var index = fs::qfs::dir_find(path_buffer, &entry);
      if (index == -1) {
        return -1;
      }

      // Delete the file.
      if (!fs::qfs::dir_delete(index)) {
        return -1;
      }

      return 0;
    }

    function _spawn(sc: syscall): byte {
      // TODO: implement spawn syscall
      // For now, just return 0 (not implemented)
      return 0;
    }

    function init(): void {
      log("syscall: initializing...");
      // Register `syscall` to handle interrupt 0x80.
      support::interrupt(interrupts::SYSCALL, _syscall_interrupt);
      log("syscall: initialized");
    }
  }
}