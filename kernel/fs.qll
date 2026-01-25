namespace kernel {
  namespace fs {
    /////////////////////////////////////////////////////////////////////
    // QFS Constants
    /////////////////////////////////////////////////////////////////////
    namespace qfs {
      // Filesystem layout constants.
      .constant global SUPERBLOCK_SECTOR: byte = 0;
      .constant global FAT_START_SECTOR: byte = 1;
      .constant global FAT_SECTORS: byte = 8;
      .constant global ROOT_START_SECTOR: byte = 9;
      .constant global ROOT_SECTORS: byte = 8;
      .constant global DATA_START_SECTOR: byte = 17;

      // Sector size in words.
      .constant global SECTOR_SIZE: byte = 128;

      // FAT entry values.
      .constant global FAT_FREE: byte = 0x00000000;
      .constant global FAT_END: byte = 0xFFFFFFFF;
      .constant global FAT_RESERVED: byte = 0xFFFFFFFE;

      // Directory entry flags.
      .constant global DIRENT_FREE: byte = 0x00;
      .constant global DIRENT_USED: byte = 0x01;
      .constant global DIRENT_DELETED: byte = 0x80;

      // Directory entry size in words.
      .constant global DIRENT_SIZE: byte = 16;

      // Entries per sector.
      .constant global FAT_ENTRIES_PER_SECTOR: byte = 128;
      .constant global DIRENT_PER_SECTOR: byte = 8;

      // Maximum entries.
      .constant global MAX_FAT_ENTRIES: byte = 1024;
      .constant global MAX_DIR_ENTRIES: byte = 64;

      // Magic number: 'QFS1' (0x51465331).
      .constant global QFS_MAGIC: byte = 0x51465331;

      // Filename limits.
      .constant global MAX_NAME_LEN: byte = 8;
      .constant global MAX_EXT_LEN: byte = 3;

      /////////////////////////////////////////////////////////////////////
      // QFS Structures
      /////////////////////////////////////////////////////////////////////

      // Superblock structure (words 0-9 of sector 0).
      type superblock = struct {
        magic: byte;
        version: byte;
        sector_size: byte;
        total_sectors: byte;
        fat_start: byte;
        fat_sectors: byte;
        root_start: byte;
        root_sectors: byte;
        data_start: byte;
        free_sectors: byte;
      };

      // Directory entry structure (16 words).
      type dirent = struct {
        flags: byte;
        first_sector: byte;
        size: byte;
        name: byte[8];
        extension: byte[4];
        reserved: byte[2];
      };

      /////////////////////////////////////////////////////////////////////
      // QFS State
      /////////////////////////////////////////////////////////////////////

      // Cached superblock.
      global sb: superblock;
      global initialized: bool = false;

      // Sector buffer for temporary operations.
      global sector_buffer: byte[128];

      /////////////////////////////////////////////////////////////////////
      // QFS Initialization
      /////////////////////////////////////////////////////////////////////

      function init(): bool {
        if (initialized) {
          return true;
        }

        // Check if block device is available.
        if (block::base == null) {
          return false;
        }

        // Read superblock.
        if (!block::read_sector(SUPERBLOCK_SECTOR, &sector_buffer[0])) {
          return false;
        }

        // Copy superblock data.
        sb.magic = sector_buffer[0];
        sb.version = sector_buffer[1];
        sb.sector_size = sector_buffer[2];
        sb.total_sectors = sector_buffer[3];
        sb.fat_start = sector_buffer[4];
        sb.fat_sectors = sector_buffer[5];
        sb.root_start = sector_buffer[6];
        sb.root_sectors = sector_buffer[7];
        sb.data_start = sector_buffer[8];
        sb.free_sectors = sector_buffer[9];

        // Validate magic.
        if (sb.magic != QFS_MAGIC) {
          return false;
        }

        initialized = true;
        return true;
      }

      /////////////////////////////////////////////////////////////////////
      // FAT Operations
      /////////////////////////////////////////////////////////////////////

      // Read a FAT entry for a given data sector.
      function fat_read(data_sector: byte): byte {
        var fat_index = data_sector - DATA_START_SECTOR;
        var fat_sector = FAT_START_SECTOR + fat_index / FAT_ENTRIES_PER_SECTOR;
        var fat_offset = fat_index % FAT_ENTRIES_PER_SECTOR;

        if (!block::read_sector(fat_sector, &sector_buffer[0])) {
          return FAT_FREE;
        }

        return sector_buffer[fat_offset];
      }

      // Write a FAT entry for a given data sector.
      function fat_write(data_sector: byte, value: byte): bool {
        var fat_index = data_sector - DATA_START_SECTOR;
        var fat_sector = FAT_START_SECTOR + fat_index / FAT_ENTRIES_PER_SECTOR;
        var fat_offset = fat_index % FAT_ENTRIES_PER_SECTOR;

        if (!block::read_sector(fat_sector, &sector_buffer[0])) {
          return false;
        }

        sector_buffer[fat_offset] = value;

        return block::write_sector(fat_sector, &sector_buffer[0]);
      }

      // Allocate a free sector, returns 0 on failure.
      function fat_alloc(): byte {
        for (var sector = DATA_START_SECTOR; sector < sb.total_sectors; sector = sector + 1) {
          if (fat_read(sector) == FAT_FREE) {
            if (!fat_write(sector, FAT_END)) {
              return 0;
            }
            sb.free_sectors = sb.free_sectors - 1;
            _write_superblock();
            return sector;
          }
        }
        return 0;
      }

      // Free a chain of sectors starting at first_sector.
      function fat_free(first_sector: byte): void {
        var sector = first_sector;
        while (sector != FAT_END && sector != FAT_FREE && sector != 0) {
          var next = fat_read(sector);
          fat_write(sector, FAT_FREE);
          sb.free_sectors = sb.free_sectors + 1;
          sector = next;
        }
        _write_superblock();
      }

      // Write superblock back to disk.
      function _write_superblock(): bool {
        // Clear buffer.
        for (var i: byte = 0; i < SECTOR_SIZE; i = i + 1) {
          sector_buffer[i] = 0;
        }

        // Copy superblock data.
        sector_buffer[0] = sb.magic;
        sector_buffer[1] = sb.version;
        sector_buffer[2] = sb.sector_size;
        sector_buffer[3] = sb.total_sectors;
        sector_buffer[4] = sb.fat_start;
        sector_buffer[5] = sb.fat_sectors;
        sector_buffer[6] = sb.root_start;
        sector_buffer[7] = sb.root_sectors;
        sector_buffer[8] = sb.data_start;
        sector_buffer[9] = sb.free_sectors;

        return block::write_sector(SUPERBLOCK_SECTOR, &sector_buffer[0]);
      }

      /////////////////////////////////////////////////////////////////////
      // Directory Operations
      /////////////////////////////////////////////////////////////////////

      // Read a directory entry from disk into the provided struct.
      // Returns true on success.
      function _read_dirent(index: byte, entry: *dirent): bool {
        var dir_sector = ROOT_START_SECTOR + index / DIRENT_PER_SECTOR;
        var entry_offset = (index % DIRENT_PER_SECTOR) * DIRENT_SIZE;

        if (!block::read_sector(dir_sector, &sector_buffer[0])) {
          return false;
        }

        entry->flags = sector_buffer[entry_offset];
        entry->first_sector = sector_buffer[entry_offset + 1];
        entry->size = sector_buffer[entry_offset + 2];

        // Copy name (8 words).
        for (var i: byte = 0; i < 8; i = i + 1) {
          entry->name[i] = sector_buffer[entry_offset + 3 + i];
        }

        // Copy extension (4 words).
        for (var i: byte = 0; i < 4; i = i + 1) {
          entry->extension[i] = sector_buffer[entry_offset + 11 + i];
        }

        return true;
      }

      // Write a directory entry to disk.
      function _write_dirent(index: byte, entry: *dirent): bool {
        var dir_sector = ROOT_START_SECTOR + index / DIRENT_PER_SECTOR;
        var entry_offset = (index % DIRENT_PER_SECTOR) * DIRENT_SIZE;

        // Read the sector first.
        if (!block::read_sector(dir_sector, &sector_buffer[0])) {
          return false;
        }

        // Update the entry.
        sector_buffer[entry_offset] = entry->flags;
        sector_buffer[entry_offset + 1] = entry->first_sector;
        sector_buffer[entry_offset + 2] = entry->size;

        // Copy name (8 words).
        for (var i: byte = 0; i < 8; i = i + 1) {
          sector_buffer[entry_offset + 3 + i] = entry->name[i];
        }

        // Copy extension (4 words).
        for (var i: byte = 0; i < 4; i = i + 1) {
          sector_buffer[entry_offset + 11 + i] = entry->extension[i];
        }

        return block::write_sector(dir_sector, &sector_buffer[0]);
      }

      // Compare a string to a fixed-size name array.
      function _name_match(name: byte[8], str: string): bool {
        for (var i: byte = 0; i < 8; i = i + 1) {
          if (i < len str) {
            if (name[i] != str[i]) {
              return false;
            }
          } else {
            // String ended, check if name is also null/zero.
            if (name[i] != 0) {
              return false;
            }
            return true;
          }
        }
        // Check if string is longer than 8 chars.
        return len str <= 8;
      }

      // Compare extension.
      function _ext_match(ext: byte[4], str: string): bool {
        for (var i: byte = 0; i < 3; i = i + 1) {
          if (i < len str) {
            if (ext[i] != str[i]) {
              return false;
            }
          } else {
            if (ext[i] != 0) {
              return false;
            }
            return true;
          }
        }
        return len str <= 3;
      }

      // Find a directory entry by name and extension.
      // Returns the index if found, or -1 if not found.
      // If found, populates *entry with the entry data.
      function dir_find(name: string, ext: string, entry: *dirent): byte {
        for (var i: byte = 0; i < MAX_DIR_ENTRIES; i = i + 1) {
          if (!_read_dirent(i, entry)) {
            continue;
          }
          if (entry->flags == DIRENT_USED) {
            if (_name_match(entry->name, name) && _ext_match(entry->extension, ext)) {
              return i;
            }
          }
        }
        return -1;
      }

      // Find a free directory entry. Returns index or -1 if full.
      function dir_find_free(): byte {
        var entry: dirent;
        for (var i: byte = 0; i < MAX_DIR_ENTRIES; i = i + 1) {
          if (!_read_dirent(i, &entry)) {
            continue;
          }
          if (entry.flags == DIRENT_FREE || entry.flags == DIRENT_DELETED) {
            return i;
          }
        }
        return -1;
      }

      // Create a new directory entry.
      // Returns the index, or -1 on failure.
      function dir_create(name: string, ext: string, first_sector: byte, size: byte): byte {
        var index = dir_find_free();
        if (index == -1) {
          return -1;
        }

        var entry: dirent;
        entry.flags = DIRENT_USED;
        entry.first_sector = first_sector;
        entry.size = size;

        // Copy name.
        for (var i: byte = 0; i < 8; i = i + 1) {
          if (i < len name) {
            entry.name[i] = name[i];
          } else {
            entry.name[i] = 0;
          }
        }

        // Copy extension.
        for (var i: byte = 0; i < 4; i = i + 1) {
          if (i < len ext) {
            entry.extension[i] = ext[i];
          } else {
            entry.extension[i] = 0;
          }
        }

        entry.reserved[0] = 0;
        entry.reserved[1] = 0;

        if (!_write_dirent(index, &entry)) {
          return -1;
        }

        return index;
      }

      // Delete a directory entry and free its sectors.
      function dir_delete(index: byte): bool {
        var entry: dirent;
        if (!_read_dirent(index, &entry)) {
          return false;
        }

        if (entry.flags != DIRENT_USED) {
          return false;
        }

        // Free the sector chain.
        if (entry.first_sector != 0) {
          fat_free(entry.first_sector);
        }

        // Mark as deleted.
        entry.flags = DIRENT_DELETED;
        return _write_dirent(index, &entry);
      }

      /////////////////////////////////////////////////////////////////////
      // File Operations
      /////////////////////////////////////////////////////////////////////

      // File open modes.
      .constant global MODE_READ: byte = 0;
      .constant global MODE_WRITE: byte = 1;
      .constant global MODE_APPEND: byte = 2;

      // Maximum open files.
      .constant global MAX_OPEN_FILES: byte = 8;

      // Open file state.
      type file_state = struct {
        in_use: bool;
        dir_index: byte;      // Directory entry index
        first_sector: byte;   // First sector of file
        current_sector: byte; // Current sector being accessed
        file_size: byte;      // Total file size in bytes
        position: byte;       // Current position in file (bytes)
        mode: byte;           // Open mode
        modified: bool;       // Whether file has been modified
      };

      // Table of open files.
      global open_files: file_state[8];

      // Data buffer for file I/O (separate from sector_buffer).
      global file_buffer: byte[128];
      global file_buffer_sector: byte = 0;
      global file_buffer_dirty: bool = false;

      // Shift helper: get multiplier for byte position (0-3).
      // Returns 1, 256, 65536, or 16777216.
      function _byte_shift(pos: byte): byte {
        if (pos == 0) {
          return 1;
        } else if (pos == 1) {
          return 256;
        } else if (pos == 2) {
          return 65536;
        } else {
          return 16777216;
        }
      }

      // Get byte mask for position (0-3).
      // Returns 0xFF, 0xFF00, 0xFF0000, or 0xFF000000.
      function _byte_mask(pos: byte): byte {
        if (pos == 0) {
          return 0xFF;
        } else if (pos == 1) {
          return 0xFF00;
        } else if (pos == 2) {
          return 0xFF0000;
        } else {
          return 0xFF000000;
        }
      }

      // Get inverse byte mask for position (0-3).
      // Returns ~0xFF, ~0xFF00, ~0xFF0000, or ~0xFF000000.
      function _byte_mask_inv(pos: byte): byte {
        if (pos == 0) {
          return 0xFFFFFF00;
        } else if (pos == 1) {
          return 0xFFFF00FF;
        } else if (pos == 2) {
          return 0xFF00FFFF;
        } else {
          return 0x00FFFFFF;
        }
      }

      // Flush the file buffer if dirty.
      function _flush_file_buffer(): bool {
        if (file_buffer_dirty && file_buffer_sector != 0) {
          if (!block::write_sector(file_buffer_sector, &file_buffer[0])) {
            return false;
          }
          file_buffer_dirty = false;
        }
        return true;
      }

      // Load a sector into the file buffer.
      function _load_file_buffer(sector: byte): bool {
        if (file_buffer_sector == sector) {
          return true;
        }
        if (!_flush_file_buffer()) {
          return false;
        }
        if (!block::read_sector(sector, &file_buffer[0])) {
          return false;
        }
        file_buffer_sector = sector;
        return true;
      }

      // Find a free file slot. Returns index or -1 if full.
      function _find_free_slot(): byte {
        for (var i: byte = 0; i < MAX_OPEN_FILES; i = i + 1) {
          if (!open_files[i].in_use) {
            return i;
          }
        }
        return -1;
      }

      // Parse a filename into name and extension.
      // Looks for the last '.' in the path.
      function _parse_filename(path: string, name: *byte, name_len: *byte, ext: *byte, ext_len: *byte): void {
        var dot_pos: byte = -1;
        var start: byte = 0;

        // Find the last '/' to get just the filename.
        for (var i: byte = 0; i < len path; i = i + 1) {
          if (path[i] == '/') {
            start = i + 1;
          }
        }

        // Find the last '.'.
        for (var i = start; i < len path; i = i + 1) {
          if (path[i] == '.') {
            dot_pos = i;
          }
        }

        if (dot_pos == -1 || dot_pos == start) {
          // No extension.
          *name_len = len path - start;
          if (*name_len > MAX_NAME_LEN) {
            *name_len = MAX_NAME_LEN;
          }
          for (var i: byte = 0; i < *name_len; i = i + 1) {
            name[unsafe i] = path[start + i];
          }
          *ext_len = 0;
        } else {
          // Has extension.
          *name_len = dot_pos - start;
          if (*name_len > MAX_NAME_LEN) {
            *name_len = MAX_NAME_LEN;
          }
          for (var i: byte = 0; i < *name_len; i = i + 1) {
            name[unsafe i] = path[start + i];
          }

          *ext_len = len path - dot_pos - 1;
          if (*ext_len > MAX_EXT_LEN) {
            *ext_len = MAX_EXT_LEN;
          }
          for (var i: byte = 0; i < *ext_len; i = i + 1) {
            ext[unsafe i] = path[dot_pos + 1 + i];
          }
        }
      }

      // Open a file. Returns file slot index, or -1 on failure.
      function file_open(path: string, mode: byte): byte {
        if (!initialized) {
          if (!init()) {
            return -1;
          }
        }

        var slot = _find_free_slot();
        if (slot == -1) {
          return -1;
        }

        // Parse filename.
        var name: byte[8];
        var ext: byte[4];
        var name_len: byte = 0;
        var ext_len: byte = 0;

        // Clear arrays.
        for (var i: byte = 0; i < 8; i = i + 1) {
          name[i] = 0;
        }
        for (var i: byte = 0; i < 4; i = i + 1) {
          ext[i] = 0;
        }

        _parse_filename(path, &name[0], &name_len, &ext[0], &ext_len);

        // Create temp strings for lookup (need to set len).
        var name_str: byte[9];
        var ext_str: byte[4];
        for (var i: byte = 0; i < name_len; i = i + 1) {
          name_str[i] = name[i];
        }
        len name_str = name_len;
        for (var i: byte = 0; i < ext_len; i = i + 1) {
          ext_str[i] = ext[i];
        }
        len ext_str = ext_len;

        // Find file.
        var entry: dirent;
        var dir_index = dir_find(name_str, ext_str, &entry);

        if (mode == MODE_READ) {
          // File must exist.
          if (dir_index == -1) {
            return -1;
          }
        } else {
          // For write/append, create if not exists.
          if (dir_index == -1) {
            // Create empty file.
            dir_index = dir_create(name_str, ext_str, 0, 0);
            if (dir_index == -1) {
              return -1;
            }
            entry.flags = DIRENT_USED;
            entry.first_sector = 0;
            entry.size = 0;
          }
        }

        // Initialize file state.
        open_files[slot].in_use = true;
        open_files[slot].dir_index = dir_index;
        open_files[slot].first_sector = entry.first_sector;
        open_files[slot].current_sector = entry.first_sector;
        open_files[slot].file_size = entry.size;
        open_files[slot].mode = mode;
        open_files[slot].modified = false;

        if (mode == MODE_APPEND) {
          open_files[slot].position = entry.size;
          // Seek to end - find the last sector.
          if (entry.first_sector != 0 && entry.size > 0) {
            var sector = entry.first_sector;
            var remaining = entry.size;
            while (remaining > SECTOR_SIZE * 4) {
              var next = fat_read(sector);
              if (next == FAT_END || next == FAT_FREE) {
                break;
              }
              sector = next;
              remaining = remaining - SECTOR_SIZE * 4;
            }
            open_files[slot].current_sector = sector;
          }
        } else {
          open_files[slot].position = 0;
        }

        return slot;
      }

      // Close a file and flush any pending writes.
      function file_close(slot: byte): bool {
        if (slot < 0 || slot >= MAX_OPEN_FILES) {
          return false;
        }
        if (!open_files[slot].in_use) {
          return false;
        }

        // Flush buffer if needed.
        _flush_file_buffer();

        // Update directory entry if modified.
        if (open_files[slot].modified) {
          var entry: dirent;
          if (_read_dirent(open_files[slot].dir_index, &entry)) {
            entry.first_sector = open_files[slot].first_sector;
            entry.size = open_files[slot].file_size;
            _write_dirent(open_files[slot].dir_index, &entry);
          }
        }

        open_files[slot].in_use = false;
        return true;
      }

      // Read bytes from a file. Returns number of bytes read.
      function file_read(slot: byte, buffer: *byte, count: byte): byte {
        if (slot < 0 || slot >= MAX_OPEN_FILES) {
          return 0;
        }
        if (!open_files[slot].in_use) {
          return 0;
        }

        var state = &open_files[slot];
        var bytes_read: byte = 0;

        while (bytes_read < count && state->position < state->file_size) {
          // Calculate position within sector.
          // Each word is 4 bytes, sector is SECTOR_SIZE words.
          var sector_bytes = SECTOR_SIZE * 4;
          var pos_in_sector = state->position % sector_bytes;
          var word_offset = pos_in_sector / 4;
          var byte_in_word = pos_in_sector % 4;

          // Make sure we have the right sector loaded.
          if (state->current_sector == 0) {
            break;
          }

          if (!_load_file_buffer(state->current_sector)) {
            break;
          }

          // Read a byte.
          var word = file_buffer[word_offset];
          var b = (word / _byte_shift(byte_in_word)) & 0xFF;
          buffer[unsafe bytes_read] = b;

          bytes_read = bytes_read + 1;
          state->position = state->position + 1;

          // Move to next sector if needed.
          if (state->position % sector_bytes == 0) {
            var next = fat_read(state->current_sector);
            if (next != FAT_END && next != FAT_FREE) {
              state->current_sector = next;
            }
          }
        }

        return bytes_read;
      }

      // Write bytes to a file. Returns number of bytes written.
      function file_write(slot: byte, buffer: *byte, count: byte): byte {
        if (slot < 0 || slot >= MAX_OPEN_FILES) {
          return 0;
        }
        if (!open_files[slot].in_use) {
          return 0;
        }
        if (open_files[slot].mode == MODE_READ) {
          return 0;
        }

        var state = &open_files[slot];
        var bytes_written: byte = 0;
        var sector_bytes = SECTOR_SIZE * 4;

        while (bytes_written < count) {
          // Allocate first sector if needed.
          if (state->first_sector == 0) {
            state->first_sector = fat_alloc();
            if (state->first_sector == 0) {
              break;
            }
            state->current_sector = state->first_sector;
          }

          // Allocate new sector if at end of current one.
          if (state->position > 0 && state->position % sector_bytes == 0) {
            var next = fat_read(state->current_sector);
            if (next == FAT_END || next == FAT_FREE) {
              // Allocate new sector.
              var new_sector = fat_alloc();
              if (new_sector == 0) {
                break;
              }
              fat_write(state->current_sector, new_sector);
              state->current_sector = new_sector;
            } else {
              state->current_sector = next;
            }
          }

          // Load current sector.
          if (!_load_file_buffer(state->current_sector)) {
            break;
          }

          // Calculate position within sector.
          var pos_in_sector = state->position % sector_bytes;
          var word_offset = pos_in_sector / 4;
          var byte_in_word = pos_in_sector % 4;

          // Write a byte.
          var word = file_buffer[word_offset];
          var mask = _byte_mask_inv(byte_in_word);
          var b = buffer[unsafe bytes_written] & 0xFF;
          word = (word & mask) | (b * _byte_shift(byte_in_word));
          file_buffer[word_offset] = word;
          file_buffer_dirty = true;

          bytes_written = bytes_written + 1;
          state->position = state->position + 1;
          state->modified = true;

          // Update file size if we wrote past the end.
          if (state->position > state->file_size) {
            state->file_size = state->position;
          }
        }

        return bytes_written;
      }
    }

    /////////////////////////////////////////////////////////////////////
    // Handle-based file system interface
    /////////////////////////////////////////////////////////////////////
    type handle = byte;
    namespace handle {
      .constant global OUTPUT: handle = 0x1;
      .constant global INPUT: handle = 0x2;
      global id: handle = 0x3;
    }

    type file = struct {
      path: string;
      handle: handle;
    };

    type files = std::vector<file>;

    function _find_file(file: file, handle: handle): bool {
      return file.handle == handle;
    }

    function read(handle: handle, data: byte[]): bool {
      var process = process::current_process();

      if(handle == handle::INPUT){
        return std::buffered::read(
          &peripherals::debug_input->control,
          &peripherals::debug_input->size,
          &peripherals::debug_input->buffer[unsafe 0],
          data
        );
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        file.path
      )){
        return false;
      }
      return std::buffered::read(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        data
      );
    }

    // Write a single byte to a handle (used by syscalls)
    function write_byte(handle: handle, ch: byte): bool {
      if(handle == handle::OUTPUT){
        // Write directly to debug output buffer
        peripherals::debug_output->buffer[unsafe 0] = ch;
        peripherals::debug_output->size = 1;
        peripherals::debug_output->control = std::buffered::WRITE;
        while(peripherals::debug_output->control == std::buffered::PENDING){}
        return peripherals::debug_output->control == std::buffered::READY;
      }
      // For other handles, not implemented
      return false;
    }

    function write(handle: handle, data: byte[]): bool {
      var process = process::current_process();

      if(handle == handle::OUTPUT){
        return std::buffered::write(
          &peripherals::debug_output->control,
          &peripherals::debug_output->size,
          &peripherals::debug_output->buffer[unsafe 0],
          data
        );
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        file.path
      )){
        return false;
      }
      return std::buffered::write(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        data
      );
    }

    function open(path: string): handle {
      // Just creates a `file` with the given path. Since we want
      // this to be cleaned up when the process is cleaned up, we
      // store it with the process.
      var process = process::current_process();

      // Assign the file a handle.
      var h = handle::id;
      handle::id = handle::id + 1;

      // Be sure to copy the path because it's a string that lives
      // in the memory of the calling process.
      std::vector::add(&process->files, file {
        path = std::str::from_string(path),
        handle = h,
      });

      return h;
    }

    function close(handle: handle): void {
      var process = process::current_process();
      var i = std::vector::find_by(process->files, _find_file, handle);
      if(i == -1){
        return;
      }

      _destroy_file(process->files[i]);

      std::vector::remove(process->files, i);
    }

    function _destroy_file(file: file): void {
      delete file.path;
    }

    function create_files(): files {
      return <files>std::vector::create<file>(2);
    }

    function destroy_files(files: files): void {
      std::vector::foreach(files, _destroy_file);
      std::vector::destroy(files);
    }

    function init(): void {}
  }
}