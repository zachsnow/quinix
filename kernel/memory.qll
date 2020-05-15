namespace kernel {
  namespace memory {
    type flags = byte;
    namespace flags {
      .constant global PRESENT: byte = 0b0001;
      .constant global READ: byte = 0b0010;
      .constant global WRITE: byte = 0b0100;
      .constant global EXECUTE: byte = 0b1000;
    }

    // Pages represent *allocated* memory.
    type page = struct {
      virtual_address: byte;
      physical_address: byte;
      program_base: byte;
      size: byte;
      flags: flags;
    };

    type table = struct {
      pages: page[];
    };

    // All active tables.
    global tables: std::vector<table>;

    // Chunks represet physical memory.
    type chunk = byte;
    global chunk_size: byte = 0x4000;
    global max_chunks: byte = 0x400;
    global physical_chunks: std::vector<chunk> = null;

    function allocate_physical_memory(size: byte): byte {
      return 0;
    }

    function deallocate_physical_memory(address: byte): void {
      return;
    }

    function create_table(executable_base: byte, executable_size: byte, heap_size: byte, stack_size: byte): table {
      // Default virtual memory layout; leave some space after the executable
      // unmapped in case we "run off the end"; leave some space between the
      // heap and the stack so we can tell if we run out of space.
      var heap_base = executable_base + executable_size + 0x1000;
      var stack_base = heap_base + 0x1000;

      // Find an available physical location.
      var base = _allocate_physical_memory(executable_size + heap_size + stack_size);

      // We map 3 pages: executable, heap, andstack. We leave low addresses
      // unmapped so that a null pointer access will raise.
      //
      // TODO: maybe we also want some "static" memory somewhere?
      var pages = new page[] = [
        page {
          virtual_address = executable_base,
          physical_address = base,
          size = executable_size,
          flags = flag_present | flag_read | flag_execute,
        },
        page {
          virtual_address = heap_base,
          physical_address = base + executable_size,
          size = heap_size,
          flags = flag_present | flag_read | flag_write,
        },
        page {
          virtual_address = stack_base,
          physical_address = base + executable_size + heap_size,
          size = stack_size,
          flags = flag_present | flag_read | flag_write,
        },
      ];
      return table {
        pages = pages,
      };
    }

    function destroy_table(table: * table): void {
      std::vector::remove(table, table);
    }

    type mmu = struct {
      enabled: bool;
      table: * table;
    };

    global mmu: * mmu = null;

    function enable(): void {
      mmu->enabled = true;
    }

    function disable(): void {
      mmu->enabled = false;
    }

    function use_table(table: * table): void {
      mmu->table = table;
    }

    function translate(table: * table, p: * byte): * byte {
      // `p` is a virtual address. Translate it against
      // the given table and return the physical address,
      // or return `null`.
      var addr = <unsafe byte>p;
      for(var i = 0; i < len table->pages; i = i + 1){
        var page = table->pages[i];
        if(addr >= page.virtual_address && addr < page.virtual_address + size){
          return <unsafe * byte>(page.physical_address + addr - page.virtual_address);
        }
      }
      return null;
    }

    function init(): void {
      mmu = kernel::peripherals::mmu;
      disable();
      use_table(null);
    }
  }
}
