namespace memory {
  type flags = byte;

  global flag_present: .constant byte = 0b0001;
  global flag_read: .constant byte = 0b0010;
  global flag_write: .constant byte = 0b0100;
  global flag_execute: .constant byte = 0b1000;

  type page = struct {
    virtual_address: byte;
    physical_address: byte;
    size: byte;
    flags: flags;
  };

  type table = struct {
    pages: page[];
  }

  global tables: table[] = [];

  type chunk = byte;
  global chunk_size = 0x4000;
  global max_chunks = 0x400;
  global physical_chunks: chunk[4] = [
    0, 0, 0, 0,
  ];

  function allocate_chunks(chunk: byte, count: byte): * byte {
    // Mark found chunks as allocated.
    physical_chunks[chunk] = count;
    for(var c = 1; c < chunk_count; c++){
      physical_chunks[c + chunk] = -1;
    }
    return <* byte>(chunk * chunk_size);
  }

  function allocate_physical_memory(size: byte): * byte {
    var base_chunk = 0;
    var allocated_chunks = 0;
    for(var i = 0; i < len physical_chunks; i++){
      if(!physical_chunks[i]){
        // If this is the first chunk we have allocated, record
        // it as the start.
        if(allocated_chunks == 0){
          base_chunk = i;
        }
        allocated_chunks++;

        // If we've allocated enough physical memory, mark it as
        // allocated and return it.
        if(allocated_chunks * chunk_size >= size){
          return allocate_chunks(base_chunk, allocated_chunks);
        }
      }
      else {
        base_chunk = 0;
        size_allocated = 0;
      }
    }

    // We didn't find space in our already allocated chunks;
    // try to allocate more chunks.
    var new_size = len physical_chunks * 2;
    if(new_size < max_chunks){
      base_chunk = len physical_chunks;

      var more_chunks = new chunk[new_size];
      more_chunks = physical_chunks;
      physical_chunks = &more_chunks;

      return allocate_chunks(base_chunk, size / chunk_size);
    }

    kernel::panic('out of physical memory');
  }

  function deallocate_physical_memory(address: * byte): void {
    var base_chunk = address / chunk_size;
    if(base_chunk >= len physical_chunks){
      kernel::panic('deallocating invalid chunk');
    }

    var chunk_count = physical_chunks[i];
    if(chunk_count == 0){
      kernel::panic('deallocating unallocated chunk');
    }
    if(chunk_count == -1){
      kernel::panic('deallocating sub-chunk');
    }

    // Mark each chunk as unallocated.
    for(var i = 0; i < chunk_count; i++){
      physical_chunks[base_chunk + i] = 0;
    }
  }

  function create_table(static_size: byte, executable_size: byte, heap_size: byte, stack_size: byte) {
    // Default virtual memory layout.
    var static_base = 0x10;
    var executable_base = 0x1000;
    var read_write_base = 0x10000;

    // Find an available physical location.
    var base = allocate_physical_memory(static_size + executable_size + heap_size + stack_size);

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

    var table: * table = new table {
      pages = pages,
    };

    return table;
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


  function init(): void {
    mmu = <* mmu>kernel::peripherals::mmu_ptr;
  }
}
