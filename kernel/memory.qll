namespace memory {
  type flags = byte;
  namespace flags {
    .constant global PRESENT: byte = 0b0001;
    .constant global READ: byte = 0b0010;
    .constant global WRITE: byte = 0b0100;
    .constant global EXECUTE: byte = 0b1000;
  }

  type page = struct {
    virtual_address: byte;
    physical_address: byte;
    size: byte;
    flags: flags;
  };

  type table = struct {
    pages: page[];
  }

  global tables: *table[] = [];

  type chunk = byte;
  global chunk_size = 0x4000;
  global max_chunks = 0x400;
  global physical_chunks: chunk[4] = [
    0, 0, 0, 0,
  ];

  function create_table(static_size: byte, executable_size: byte, heap_size: byte, stack_size: byte): * table {
    // Default virtual memory layout.
    var static_base = 0x10;
    var executable_base = 0x1000;
    var read_write_base = 0x10000;

    // Find an available physical location.
    var base = _allocate_physical_memory(static_size + executable_size + heap_size + stack_size);

    // We map 3 pages: static, executable, and heap/stack. We leave the
    // first 0x10 bytes unmapped so that a null pointer access will raise.
    var pages: page[] = new page[] [
      page {
        virtual_address = static_base,
        physical_address = base,
        size: static_size,
        flags: flag_present | flag_read,
      },
      page {
        virtual_address = executable_base,
        physical_address = base + static_size,
        size: executable_size,
        flags: flag_present | flag_read | flag_execute,
      },
      page {
        virtual_address = read_write_space,
        physical_address = base + static_size + executable_size,
        size: heap_size + stack_size,
        flags: flag_present | flag_read | flag_write,
      },
    ];

    return new table = table {
      pages = pages,
    };
  }


  function destroy_table(table: * table){

  }

  type mmu = struct {
    enabled: bool;
    table: * table;
  };

  global mmu: * mmu = 0x0;

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
  }
}
