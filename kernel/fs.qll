namespace kernel {
  namespace fs {
    /////////////////////////////////////////////////////////////////////
    // QFS v2 Constants
    /////////////////////////////////////////////////////////////////////
    namespace qfs {
      // Filesystem layout constants.
      .constant global SUPERBLOCK_SECTOR: byte = 0;
      .constant global FAT_START_SECTOR: byte = 1;

      // Sector size in words.
      .constant global SECTOR_SIZE: byte = 128;

      // FAT entry values.
      .constant global FAT_FREE: byte = 0x00000000;
      .constant global FAT_END: byte = 0xFFFFFFFF;
      .constant global FAT_RESERVED: byte = 0xFFFFFFFE;

      // Directory entry flags.
      .constant global DIRENT_FREE: byte = 0x00;
      .constant global DIRENT_USED: byte = 0x01;
      .constant global DIRENT_DIRECTORY: byte = 0x02;
      .constant global DIRENT_EXECUTABLE: byte = 0x04;
      .constant global DIRENT_DELETED: byte = 0x80;

      // Directory entry size in words (32 words = 128 bytes).
      .constant global DIRENT_SIZE: byte = 32;

      // Entries per sector.
      .constant global FAT_ENTRIES_PER_SECTOR: byte = 128;
      .constant global DIRENT_PER_SECTOR: byte = 4;

      // Magic number: "QFS2" (0x51465332).
      .constant global QFS_MAGIC: byte = 0x51465332;

      // Filename limit (24 chars, one per word).
      .constant global MAX_NAME_LEN: byte = 24;

      /////////////////////////////////////////////////////////////////////
      // QFS Structures
      /////////////////////////////////////////////////////////////////////

      // Superblock structure (words 0-8 of sector 0).
      // Matches QFS v2 layout.
      type superblock = struct {
        magic: byte;
        version: byte;
        sector_size: byte;
        total_sectors: byte;
        fat_start: byte;
        fat_sectors: byte;
        root_start: byte;    // rootSector in v2
        data_start: byte;
        free_sectors: byte;
      };

      // Directory entry structure (32 words).
      // Layout: flags(1) + first_sector(1) + size(1) + reserved(1) + name(24) + reserved(4)
      type dirent = struct {
        flags: byte;
        first_sector: byte;
        size: byte;
        reserved0: byte;
        name: byte[24];
        reserved1: byte[4];
      };

      /////////////////////////////////////////////////////////////////////
      // QFS State
      /////////////////////////////////////////////////////////////////////

      // Cached superblock.
      global sb: superblock = superblock {};
      global initialized: bool = false;

      // Sector buffer for temporary operations.
      global sector_buffer: byte[128] = [0; 128];

      /////////////////////////////////////////////////////////////////////
      // QFS Initialization
      /////////////////////////////////////////////////////////////////////

      function init(): bool {
        if (initialized) {
          return true;
        }

        // Check if block device is available.
        if (block::base == null) {
          kernel::log("qfs: no block device");
          return false;
        }

        // Read superblock.
        if (!block::read_sector(SUPERBLOCK_SECTOR, &sector_buffer[0])) {
          kernel::log("qfs: read superblock failed");
          return false;
        }

        // Copy superblock data (v2 layout).
        sb.magic = sector_buffer[0];
        sb.version = sector_buffer[1];
        sb.sector_size = sector_buffer[2];
        sb.total_sectors = sector_buffer[3];
        sb.fat_start = sector_buffer[4];
        sb.fat_sectors = sector_buffer[5];
        sb.root_start = sector_buffer[6];
        sb.data_start = sector_buffer[7];
        sb.free_sectors = sector_buffer[8];

        // Validate magic.
        if (sb.magic != QFS_MAGIC) {
          kernel::log("qfs: bad magic");
          return false;
        }

        initialized = true;
        return true;
      }

      /////////////////////////////////////////////////////////////////////
      // FAT Operations
      /////////////////////////////////////////////////////////////////////

      // Read a FAT entry for a given data sector.
      // Note: FAT index equals sector number (not offset from data_start)
      function fat_read(data_sector: byte): byte {
        var fat_index = data_sector;
        var fat_sector = sb.fat_start + fat_index / FAT_ENTRIES_PER_SECTOR;
        var fat_offset = fat_index % FAT_ENTRIES_PER_SECTOR;

        if (!block::read_sector(fat_sector, &sector_buffer[0])) {
          return FAT_FREE;
        }

        return sector_buffer[fat_offset];
      }

      // Write a FAT entry for a given data sector.
      // Note: FAT index equals sector number (not offset from data_start)
      function fat_write(data_sector: byte, value: byte): bool {
        var fat_index = data_sector;
        var fat_sector = sb.fat_start + fat_index / FAT_ENTRIES_PER_SECTOR;
        var fat_offset = fat_index % FAT_ENTRIES_PER_SECTOR;

        if (!block::read_sector(fat_sector, &sector_buffer[0])) {
          return false;
        }

        sector_buffer[fat_offset] = value;

        return block::write_sector(fat_sector, &sector_buffer[0]);
      }

      // Allocate a free sector, returns 0 on failure.
      function fat_alloc(): byte {
        for (var sector = sb.data_start; sector < sb.total_sectors; sector = sector + 1) {
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

      // Write superblock back to disk (v2 layout).
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
        sector_buffer[7] = sb.data_start;
        sector_buffer[8] = sb.free_sectors;

        return block::write_sector(SUPERBLOCK_SECTOR, &sector_buffer[0]);
      }

      /////////////////////////////////////////////////////////////////////
      // Directory Operations
      /////////////////////////////////////////////////////////////////////

      // Result of directory search operations.
      type dir_result = struct {
        sector: byte;      // Sector containing the entry
        slot: byte;        // Slot index within sector (0-3)
        found: bool;       // Whether the entry was found
      };

      // Read a directory entry at (sector, slot) into the provided struct.
      function _read_dirent_at(sector: byte, slot: byte, entry: *dirent): bool {
        var entry_offset = slot * DIRENT_SIZE;

        if (!block::read_sector(sector, &sector_buffer[0])) {
          return false;
        }

        entry->flags = sector_buffer[entry_offset];
        entry->first_sector = sector_buffer[entry_offset + 1];
        entry->size = sector_buffer[entry_offset + 2];
        entry->reserved0 = sector_buffer[entry_offset + 3];

        // Copy name (24 words, starting at offset 4).
        for (var i: byte = 0; i < 24; i = i + 1) {
          entry->name[i] = sector_buffer[entry_offset + 4 + i];
        }

        return true;
      }

      // Write a directory entry at (sector, slot).
      function _write_dirent_at(sector: byte, slot: byte, entry: *dirent): bool {
        var entry_offset = slot * DIRENT_SIZE;

        // Read the sector first.
        if (!block::read_sector(sector, &sector_buffer[0])) {
          return false;
        }

        // Update the entry.
        sector_buffer[entry_offset] = entry->flags;
        sector_buffer[entry_offset + 1] = entry->first_sector;
        sector_buffer[entry_offset + 2] = entry->size;
        sector_buffer[entry_offset + 3] = 0;  // reserved

        // Copy name (24 words, starting at offset 4).
        for (var i: byte = 0; i < 24; i = i + 1) {
          sector_buffer[entry_offset + 4 + i] = entry->name[i];
        }

        // Clear remaining reserved words.
        for (var i: byte = 0; i < 4; i = i + 1) {
          sector_buffer[entry_offset + 28 + i] = 0;
        }

        return block::write_sector(sector, &sector_buffer[0]);
      }

      // Legacy wrappers for root directory (used by file_close).
      function _read_dirent(index: byte, entry: *dirent): bool {
        var sector = sb.root_start + index / DIRENT_PER_SECTOR;
        var slot = index % DIRENT_PER_SECTOR;
        return _read_dirent_at(sector, slot, entry);
      }

      function _write_dirent(index: byte, entry: *dirent): bool {
        var sector = sb.root_start + index / DIRENT_PER_SECTOR;
        var slot = index % DIRENT_PER_SECTOR;
        return _write_dirent_at(sector, slot, entry);
      }

      // Compare a string to a fixed-size name array (24 chars).
      function _name_match(name: byte[24], str: string): bool {
        for (var i: byte = 0; i < 24; i = i + 1) {
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
        // Check if string is longer than 24 chars.
        return len str <= 24;
      }

      // Find a directory entry by name in a directory.
      // Follows FAT chain for multi-sector directories.
      // Returns result with sector/slot if found, or found=false.
      function dir_find_in(dir_sector: byte, name: string, entry: *dirent): dir_result {
        var result: dir_result = dir_result { sector = 0, slot = 0, found = false };
        var sector = dir_sector;

        while (sector != FAT_END && sector != FAT_FREE && sector != 0) {
          for (var slot: byte = 0; slot < DIRENT_PER_SECTOR; slot = slot + 1) {
            if (!_read_dirent_at(sector, slot, entry)) {
              continue;
            }
            if ((entry->flags & DIRENT_USED) != 0 && (entry->flags & DIRENT_DELETED) == 0) {
              if (_name_match(entry->name, name)) {
                result.sector = sector;
                result.slot = slot;
                result.found = true;
                return result;
              }
            }
          }
          sector = fat_read(sector);
        }

        return result;
      }

      // Find a free slot in a directory.
      // Follows FAT chain, allocates new sector if needed.
      // Returns result with sector/slot, or found=false if allocation failed.
      function dir_find_free_in(dir_sector: byte): dir_result {
        var result: dir_result = dir_result { sector = 0, slot = 0, found = false };
        var sector = dir_sector;
        var prev_sector: byte = 0;
        var entry: dirent;

        while (sector != FAT_END && sector != FAT_FREE && sector != 0) {
          for (var slot: byte = 0; slot < DIRENT_PER_SECTOR; slot = slot + 1) {
            if (!_read_dirent_at(sector, slot, &entry)) {
              continue;
            }
            if (entry.flags == DIRENT_FREE || (entry.flags & DIRENT_DELETED) != 0) {
              result.sector = sector;
              result.slot = slot;
              result.found = true;
              return result;
            }
          }
          prev_sector = sector;
          sector = fat_read(sector);
        }

        // No free slot found - allocate a new sector.
        var new_sector = fat_alloc();
        if (new_sector == 0) {
          return result;
        }

        // Link the new sector to the chain.
        if (prev_sector != 0) {
          fat_write(prev_sector, new_sector);
        }

        // Clear the new sector.
        for (var i: byte = 0; i < SECTOR_SIZE; i = i + 1) {
          sector_buffer[i] = 0;
        }
        block::write_sector(new_sector, &sector_buffer[0]);

        result.sector = new_sector;
        result.slot = 0;
        result.found = true;
        return result;
      }

      // Legacy wrapper: find in root directory.
      function dir_find(name: string, entry: *dirent): byte {
        var result = dir_find_in(sb.root_start, name, entry);
        if (result.found) {
          // Return a flat index for backwards compatibility.
          // This only works correctly for single-sector root.
          return result.slot;
        }
        return -1;
      }

      // Legacy wrapper: find free in root directory.
      function dir_find_free(): byte {
        var result = dir_find_free_in(sb.root_start);
        if (result.found) {
          return result.slot;
        }
        return -1;
      }

      // Create an entry in a directory.
      // Returns true on success.
      function dir_create_in(dir_sector: byte, name: string, first_sector: byte, size: byte, flags: byte, result: *dir_result): bool {
        *result = dir_find_free_in(dir_sector);
        if (!result->found) {
          return false;
        }

        var entry: dirent = dirent {};
        entry.flags = flags;
        entry.first_sector = first_sector;
        entry.size = size;

        // Copy name (up to 24 chars).
        for (var i: byte = 0; i < 24; i = i + 1) {
          if (i < len name) {
            entry.name[i] = name[i];
          } else {
            entry.name[i] = 0;
          }
        }

        return _write_dirent_at(result->sector, result->slot, &entry);
      }

      // Legacy wrapper: create in root directory.
      function dir_create(name: string, first_sector: byte, size: byte): byte {
        var result: dir_result;
        if (!dir_create_in(sb.root_start, name, first_sector, size, DIRENT_USED, &result)) {
          return -1;
        }
        return result.slot;
      }

      // Delete an entry at (sector, slot) and free its sectors.
      function dir_delete_at(sector: byte, slot: byte): bool {
        var entry: dirent;
        if (!_read_dirent_at(sector, slot, &entry)) {
          return false;
        }

        if ((entry.flags & DIRENT_USED) == 0) {
          return false;
        }

        // Free the sector chain.
        if (entry.first_sector != 0) {
          fat_free(entry.first_sector);
        }

        // Mark as deleted.
        entry.flags = DIRENT_DELETED;
        return _write_dirent_at(sector, slot, &entry);
      }

      // Legacy wrapper: delete from root by index.
      function dir_delete(index: byte): bool {
        return dir_delete_at(sb.root_start, index);
      }

      /////////////////////////////////////////////////////////////////////
      // Path Resolution
      /////////////////////////////////////////////////////////////////////

      // Result of path resolution.
      type path_result = struct {
        parent_sector: byte;  // Sector of parent directory
        entry: dirent;        // The resolved entry
        dir_result: dir_result;  // Location of entry
        found: bool;          // Whether the path was found
      };

      // Resolve a path to its directory entry.
      // Handles paths like "/foo/bar/file.txt" or "file.txt".
      function resolve_path(path: string, result: *path_result): bool {
        result->found = false;
        result->parent_sector = sb.root_start;

        if (len path == 0) {
          return false;
        }

        // Start at root.
        var current_sector = sb.root_start;

        // Skip leading slash.
        var start: byte = 0;
        if (path[0] == '/') {
          start = 1;
        }

        // If path is just "/" or empty after slash, return root.
        if (start >= len path) {
          result->entry.flags = DIRENT_USED | DIRENT_DIRECTORY;
          result->entry.first_sector = sb.root_start;
          result->entry.size = 0;
          result->dir_result.sector = 0;
          result->dir_result.slot = 0;
          result->dir_result.found = true;
          result->found = true;
          return true;
        }

        // Parse path components.
        var component: byte[24] = [0; 24];
        var comp_len: byte = 0;
        var i = start;

        while (i <= len path) {
          var ch: byte = 0;
          if (i < len path) {
            ch = path[i];
          }

          if (ch == '/' || i == len path) {
            if (comp_len > 0) {
              // Look up this component.
              var dr = dir_find_in(current_sector, component[0:comp_len], &result->entry);
              if (!dr.found) {
                return false;
              }

              result->parent_sector = current_sector;
              result->dir_result = dr;

              // If there are more components, this must be a directory.
              if (i < len path) {
                if ((result->entry.flags & DIRENT_DIRECTORY) == 0) {
                  return false;
                }
                current_sector = result->entry.first_sector;
              }

              // Clear component for next iteration.
              for (var j: byte = 0; j < comp_len; j = j + 1) {
                component[j] = 0;
              }
              comp_len = 0;
            }
          } else {
            if (comp_len < 24) {
              component[comp_len] = ch;
              comp_len = comp_len + 1;
            }
          }
          i = i + 1;
        }

        result->found = true;
        return true;
      }

      // Resolve the parent directory of a path.
      // Returns the parent directory sector, and sets *filename to the final component.
      function resolve_parent(path: string, filename: *byte, filename_len: *byte): byte {
        *filename_len = 0;

        if (len path == 0) {
          return 0;
        }

        // Find the last slash to separate parent from filename.
        var last_slash: byte = -1;
        for (var i: byte = 0; i < len path; i = i + 1) {
          if (path[i] == '/') {
            last_slash = i;
          }
        }

        // Extract filename.
        var fname_start: byte = 0;
        if (last_slash != -1) {
          fname_start = last_slash + 1;
        }
        var fname_len: byte = len path - fname_start;
        if (fname_len > MAX_NAME_LEN) {
          fname_len = MAX_NAME_LEN;
        }
        for (var i: byte = 0; i < fname_len; i = i + 1) {
          filename[unsafe i] = path[fname_start + i];
        }
        *filename_len = fname_len;

        // If no slash or slash at start, parent is root.
        if (last_slash == -1 || last_slash == 0) {
          return sb.root_start;
        }

        // Resolve the parent path.
        var parent_path: byte[64] = [0; 64];
        for (var i: byte = 0; i < last_slash && i < 63; i = i + 1) {
          parent_path[i] = path[i];
        }

        var result: path_result;
        if (!resolve_path(parent_path[0:last_slash], &result)) {
          return 0;
        }

        if ((result.entry.flags & DIRENT_DIRECTORY) == 0) {
          return 0;
        }

        return result.entry.first_sector;
      }

      // Create a new directory.
      // Returns the first sector of the new directory, or 0 on failure.
      function mkdir(path: string): byte {
        var filename: byte[24] = [0; 24];
        var filename_len: byte = 0;

        var parent_sector = resolve_parent(path, &filename[0], &filename_len);
        if (parent_sector == 0 || filename_len == 0) {
          return 0;
        }

        // Check if already exists.
        var entry: dirent;
        var existing = dir_find_in(parent_sector, filename[0:filename_len], &entry);
        if (existing.found) {
          return 0;
        }

        // Allocate a sector for the new directory.
        var dir_sector = fat_alloc();
        if (dir_sector == 0) {
          return 0;
        }

        // Clear the new directory sector.
        for (var i: byte = 0; i < SECTOR_SIZE; i = i + 1) {
          sector_buffer[i] = 0;
        }
        if (!block::write_sector(dir_sector, &sector_buffer[0])) {
          fat_free(dir_sector);
          return 0;
        }

        // Create the directory entry in parent.
        var result: dir_result;
        if (!dir_create_in(parent_sector, filename[0:filename_len], dir_sector, 0, DIRENT_USED | DIRENT_DIRECTORY, &result)) {
          fat_free(dir_sector);
          return 0;
        }

        return dir_sector;
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

      // Open file state. Each open file has its own buffer to allow
      // concurrent access to multiple files.
      type file_state = struct {
        in_use: bool;
        dir_sector: byte;     // Directory sector containing entry
        dir_slot: byte;       // Slot within directory sector
        first_sector: byte;   // First sector of file
        current_sector: byte; // Current sector being accessed
        file_size: byte;      // Total file size in bytes
        position: byte;       // Current position in file (bytes)
        mode: byte;           // Open mode
        modified: bool;       // Whether file has been modified
        buffer: byte[128];    // Per-file sector buffer
        buffer_sector: byte;  // Sector currently in buffer
        buffer_dirty: bool;   // Buffer has unflushed writes
      };

      // Table of open files.
      global open_files: file_state[8] = [file_state {}; 8];

      // Shift helper: get bit shift for byte position (0-3).
      // Returns 0, 8, 16, or 24.
      function _byte_shift(pos: byte): byte {
        return pos << 3;
      }

      // Get byte mask for position (0-3).
      // Returns 0xFF, 0xFF00, 0xFF0000, or 0xFF000000.
      function _byte_mask(pos: byte): byte {
        return 0xFF << _byte_shift(pos);
      }

      // Get inverse byte mask for position (0-3).
      // Returns ~0xFF, ~0xFF00, ~0xFF0000, or ~0xFF000000.
      function _byte_mask_inv(pos: byte): byte {
        return 0xFFFFFFFF - _byte_mask(pos);
      }

      // Flush a file's buffer if dirty.
      function _flush_buffer(state: *file_state): bool {
        if (state->buffer_dirty && state->buffer_sector != 0) {
          if (!block::write_sector(state->buffer_sector, &state->buffer[0])) {
            return false;
          }
          state->buffer_dirty = false;
        }
        return true;
      }

      // Load a sector into a file's buffer.
      function _load_buffer(state: *file_state, sector: byte): bool {
        if (state->buffer_sector == sector) {
          return true;
        }
        if (!_flush_buffer(state)) {
          return false;
        }
        if (!block::read_sector(sector, &state->buffer[0])) {
          return false;
        }
        state->buffer_sector = sector;
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

        // Resolve parent directory and extract filename.
        var filename: byte[24] = [0; 24];
        var filename_len: byte = 0;
        var parent_sector = resolve_parent(path, &filename[0], &filename_len);
        if (parent_sector == 0 || filename_len == 0) {
          return -1;
        }

        // Find file in parent directory.
        var entry: dirent;
        var dr = dir_find_in(parent_sector, filename[0:filename_len], &entry);

        if (mode == MODE_READ) {
          // File must exist.
          if (!dr.found) {
            return -1;
          }
        } else {
          // For write/append, create if not exists.
          if (!dr.found) {
            // Create empty file.
            if (!dir_create_in(parent_sector, filename[0:filename_len], 0, 0, DIRENT_USED, &dr)) {
              return -1;
            }
            entry.flags = DIRENT_USED;
            entry.first_sector = 0;
            entry.size = 0;
          }
        }

        // Initialize file state.
        open_files[slot].in_use = true;
        open_files[slot].dir_sector = dr.sector;
        open_files[slot].dir_slot = dr.slot;
        open_files[slot].first_sector = entry.first_sector;
        open_files[slot].current_sector = entry.first_sector;
        open_files[slot].file_size = entry.size;
        open_files[slot].mode = mode;
        open_files[slot].modified = false;
        open_files[slot].buffer_sector = 0;
        open_files[slot].buffer_dirty = false;

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
        _flush_buffer(&open_files[slot]);

        // Update directory entry if modified.
        if (open_files[slot].modified) {
          var entry: dirent;
          var dir_sector = open_files[slot].dir_sector;
          var dir_slot = open_files[slot].dir_slot;
          if (_read_dirent_at(dir_sector, dir_slot, &entry)) {
            entry.first_sector = open_files[slot].first_sector;
            entry.size = open_files[slot].file_size;
            _write_dirent_at(dir_sector, dir_slot, &entry);
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

          if (!_load_buffer(state, state->current_sector)) {
            break;
          }

          // Read a byte.
          var word = state->buffer[word_offset];
          var b = (word >> _byte_shift(byte_in_word)) & 0xFF;
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

      // Read words from a file (for binary/executable loading).
      // Returns number of words read.
      function file_read_words(slot: byte, buffer: *byte, count: byte): byte {
        if (slot < 0 || slot >= MAX_OPEN_FILES) {
          return 0;
        }
        if (!open_files[slot].in_use) {
          return 0;
        }

        var state = &open_files[slot];
        var words_read: byte = 0;
        var sector_words = SECTOR_SIZE;

        while (words_read < count && state->position < state->file_size) {
          // Calculate position in words (position is still in bytes).
          var word_position = state->position / 4;
          var word_in_sector = word_position % sector_words;

          // Make sure we have the right sector loaded.
          if (state->current_sector == 0) {
            break;
          }

          if (!_load_buffer(state, state->current_sector)) {
            break;
          }

          // Read a word directly.
          buffer[unsafe words_read] = state->buffer[word_in_sector];

          words_read = words_read + 1;
          state->position = state->position + 4;  // Advance by 4 bytes (1 word)

          // Move to next sector if needed.
          if ((state->position / 4) % sector_words == 0) {
            var next = fat_read(state->current_sector);
            if (next != FAT_END && next != FAT_FREE) {
              state->current_sector = next;
            }
          }
        }

        return words_read;
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
          if (!_load_buffer(state, state->current_sector)) {
            break;
          }

          // Calculate position within sector.
          var pos_in_sector = state->position % sector_bytes;
          var word_offset = pos_in_sector / 4;
          var byte_in_word = pos_in_sector % 4;

          // Write a byte.
          var word = state->buffer[word_offset];
          var mask = _byte_mask_inv(byte_in_word);
          var b = buffer[unsafe bytes_written] & 0xFF;
          word = (word & mask) | (b << _byte_shift(byte_in_word));
          state->buffer[word_offset] = word;
          state->buffer_dirty = true;

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
    // Console handle constants (used by syscalls for stdin/stdout)
    /////////////////////////////////////////////////////////////////////
    type handle = byte;
    namespace handle {
      .constant global OUTPUT: handle = 0x1;
      .constant global INPUT: handle = 0x2;
    }

    // Write a single byte to console output (used by syscalls).
    function write_byte(handle: handle, ch: byte): bool {
      if (handle == handle::OUTPUT) {
        peripherals::debug_output->buffer[unsafe 0] = ch;
        peripherals::debug_output->size = 1;
        peripherals::debug_output->control = std::buffered::WRITE;
        while (peripherals::debug_output->control == std::buffered::PENDING) {}
        return peripherals::debug_output->control == std::buffered::READY;
      }
      return false;
    }
  }
}