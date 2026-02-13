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
    .constant global YIELD: byte = 0x8;
    .constant global DISPLAY_OPEN: byte = 0x9;
    .constant global DISPLAY_FLIP: byte = 0xA;
    .constant global DISPLAY_CLOSE: byte = 0xB;
    .constant global KEY_STATE: byte = 0xC;

    type syscall = struct {
      syscall: byte;
      arg0: byte;
      arg1: byte;
      arg2: byte;
    };

    // Syscall handler function type
    type handler = (syscall) => byte;

    // Syscall handler - called by trampoline which handles stack switching and INT return.
    .export function _syscall_interrupt(): void {
      log("syscall: interrupt received");
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
      log("syscall: done");
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
      _yield,
      _display_open,
      _display_flip,
      _display_close,
      _key_state,
    ];

    function _translate_pointer<T>(p: * byte): * T {
      var current_process = process::current_process();
      return <unsafe * T>memory::translate(current_process->table, p);
    }

    // Translate a user virtual address to physical
    function _translate(p: * byte): * byte {
      var current = process::current_process();
      return memory::translate(current->table, p);
    }

    // Get the data pointer from a user-space slice (translated to physical)
    function _get_slice_data(slice_addr: * byte): * byte {
      var physical_slice = _translate(slice_addr);
      if(!physical_slice){
        log("syscall: _get_slice_data: slice_addr translation failed");
        return null;
      }
      var data_virt = physical_slice[unsafe 0];  // Virtual address of data
      var result = _translate(<unsafe * byte>data_virt);
      if(!result){
        log("syscall: _get_slice_data: data_virt translation failed");
      }
      return result;
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

    function _yield(sc: syscall): byte {
      scheduler::_schedule_task(interrupts::state);
      return 0;
    }

    // Display state
    .constant global FRAMEBUFFER_VIRTUAL_BASE: byte = 0x40000;
    global display_owner_pid: byte = 0;
    global display_fb_phys: byte = 0;

    function _display_open(sc: syscall): byte {
      log("syscall: display_open");

      // Check display peripheral exists
      if (!peripherals::display) {
        log("syscall: display_open: no display");
        return -1;
      }

      // Check not already owned
      if (display_owner_pid) {
        log("syscall: display_open: already owned");
        return -1;
      }

      var proc = process::current_process();
      var disp = peripherals::display;

      // Read requested dimensions from syscall args
      var width = sc.arg1;
      var height = sc.arg2;
      if (!width || !height) {
        log("syscall: display_open: invalid dimensions");
        return -1;
      }
      var fb_size = width * height;

      // Write requested dimensions to display peripheral shared memory
      disp[unsafe 1] = width;
      disp[unsafe 2] = height;

      // Allocate physical memory for framebuffer
      var fb_phys = memory::allocate_physical_memory(fb_size);
      if (!fb_phys) {
        log("syscall: display_open: out of memory");
        return -1;
      }
      display_fb_phys = fb_phys;

      // Set the display peripheral's framebuffer pointer
      disp[unsafe 3] = fb_phys;

      // Map framebuffer into process's virtual address space
      if (!memory::add_page(
        proc->table,
        FRAMEBUFFER_VIRTUAL_BASE,
        fb_phys,
        fb_size,
        memory::flags::PRESENT | memory::flags::READ | memory::flags::WRITE
      )) {
        log("syscall: display_open: add_page failed");
        return -1;
      }

      // Rebuild MMU cache with new page
      memory::use_table(proc->table);

      // Write results to user-space struct: {fb_addr, width, height}
      var result_ptr = _translate(<unsafe *byte>sc.arg0);
      if (!result_ptr) {
        log("syscall: display_open: bad result pointer");
        return -1;
      }
      result_ptr[unsafe 0] = FRAMEBUFFER_VIRTUAL_BASE;
      result_ptr[unsafe 1] = width;
      result_ptr[unsafe 2] = height;

      display_owner_pid = proc->id;
      log("syscall: display_open: ok");
      return 0;
    }

    function _display_flip(sc: syscall): byte {
      if (!peripherals::display) {
        return -1;
      }

      var proc = process::current_process();
      if (proc->id != display_owner_pid) {
        return -1;
      }

      // Write FLIP command to display peripheral control register
      var disp = peripherals::display;
      disp[unsafe 0] = 0x01;  // FLIP

      // Spin-wait for completion
      std::wait_while(disp, 0x02);  // PENDING

      return 0;
    }

    function _display_close(sc: syscall): byte {
      log("syscall: display_close");

      var proc = process::current_process();
      if (proc->id != display_owner_pid) {
        return -1;
      }

      display_owner_pid = 0;
      display_fb_phys = 0;
      return 0;
    }

    function _key_state(sc: syscall): byte {
      if (!peripherals::keyboard) {
        return 0;
      }
      return peripherals::keyboard[unsafe 0];
    }

    function release_display(pid: byte): void {
      if (display_owner_pid == pid) {
        display_owner_pid = 0;
        display_fb_phys = 0;
      }
    }

    function init(): void {
      log("syscall: initializing...");
      // Register syscall trampoline to handle interrupt 0x80.
      // The trampoline switches to kernel stack before calling _syscall_interrupt.
      support::interrupt(interrupts::SYSCALL, support::syscall_trampoline);
      log("syscall: initialized");
    }
  }
}