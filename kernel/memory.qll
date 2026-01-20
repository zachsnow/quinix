namespace kernel::memory {
  // Configuration
  .constant global TOTAL_PHYSICAL_MEMORY: byte = 0x100000;  // 1MB
  .constant global KERNEL_RESERVED: byte = 0x20000;         // 128KB for kernel
  .constant global CHUNK_SIZE: byte = 0x1000;               // 4KB chunks

  // Kernel heap (for kernel data structures)
  .constant global KERNEL_HEAP_SIZE: byte = 0x10000;  // 64KB
  global kernel_heap_base: byte = 0x0;
  global kernel_heap_current: byte = 0x0;

  // User memory pool (for process memory)
  global user_pool_base: byte = 0x0;
  global user_pool_current: byte = 0x0;
  global user_pool_size: byte = 0x0;

  type flags = byte;
  namespace flags {
    .constant global PRESENT: byte = 0b0001;
    .constant global READ: byte = 0b0010;
    .constant global WRITE: byte = 0b0100;
    .constant global EXECUTE: byte = 0b1000;
  }

  // Pages represent *allocated* memory.
  // Layout must match VM's ListPageTablePeripheral: [virt][phys][size][flags]
  type page = struct {
    virtual_address: byte;
    physical_address: byte;
    size: byte;
    flags: flags;
  };

  // Page table is a runtime-sized array of pages.
  // Layout in memory: [count][page0][page1]... which matches VM's expected format.
  type table = page[*];

  // All active tables (currently unused - processes track their own tables).
  // global tables: std::vector<* table>;

  // Chunks represet physical memory.
  type chunk = byte;
  global chunk_size: byte = 0x4000;
  global max_chunks: byte = 0x400;
  global physical_chunks: std::vector<chunk> = null;

  function allocate_physical_memory(size: byte): byte {
    // Round up to chunk size
    var chunks_needed = (size + CHUNK_SIZE - 1) / CHUNK_SIZE;
    var bytes_needed = chunks_needed * CHUNK_SIZE;

    // Check if we have space
    if(user_pool_current + bytes_needed > user_pool_size){
      log('memory: out of physical memory');
      return 0;
    }

    var address = user_pool_base + user_pool_current;
    user_pool_current = user_pool_current + bytes_needed;

    log('memory: allocated physical memory');
    return address;
  }

  function deallocate_physical_memory(address: byte): void {
    // No-op for bump allocator
    // TODO: implement real allocator later
    return;
  }

  function allocate_kernel_memory(size: byte): * byte {
    if(kernel_heap_current + size > KERNEL_HEAP_SIZE){
      panic('memory: kernel heap exhausted');
    }

    var address = kernel_heap_base + kernel_heap_current;
    kernel_heap_current = kernel_heap_current + size;
    return <unsafe * byte>address;
  }

  function create_table(executable_base: byte, executable_size: byte, heap_size: byte, stack_size: byte): * table {
    // Default virtual memory layout; leave some space after the executable
    // unmapped in case we "run off the end"; leave some space between the
    // heap and the stack so we can tell if we run out of space.
    var heap_base = executable_base + executable_size + 0x1000;
    var stack_base = heap_base + heap_size + 0x1000;

    // Find an available physical location.
    var base = allocate_physical_memory(executable_size + heap_size + stack_size);

    // We map 3 pages: executable, heap, and stack. We leave low addresses
    // unmapped so that a null pointer access will raise.
    var pages: * table = new page[3];
    if (!pages) {
      return null;
    }

    (*pages)[0] = page {
      virtual_address = executable_base,
      physical_address = base,
      size = executable_size,
      flags = flags::PRESENT | flags::READ | flags::EXECUTE,
    };
    (*pages)[1] = page {
      virtual_address = heap_base,
      physical_address = base + executable_size,
      size = heap_size,
      flags = flags::PRESENT | flags::READ | flags::WRITE,
    };
    (*pages)[2] = page {
      virtual_address = stack_base,
      physical_address = base + executable_size + heap_size,
      size = stack_size,
      flags = flags::PRESENT | flags::READ | flags::WRITE,
    };

    return pages;
  }

  function destroy_table(t: * table): void {
    delete t;
  }

  // The MMU peripheral has a single IO word: the address of the page table.
  // Writing to it triggers the MMU to rebuild its internal page cache.
  // The page table format must be: [count][page0][page1]... where each page is
  // [virtual_address][physical_address][size][flags].
  global mmu_base_address: * byte = null;
  global current_table: * table = null;

  function enable(): void {
    // MMU is enabled when a non-null table is set.
    log('memory: enabled mmu');
  }

  function disable(): void {
    // Setting table to null disables translation.
    use_table(null);
    log('memory: disabled mmu');
  }

  function use_table(t: * table): void {
    current_table = t;
    // Write the table address to the MMU peripheral.
    // This triggers the VM's MMU to rebuild its page cache.
    *mmu_base_address = <unsafe byte>t;
  }

  function translate(t: * table, p: * byte): * byte {
    // `p` is a virtual address. Translate it against
    // the given table and return the physical address,
    // or return `null`.
    if (!t) {
      return null;
    }
    var addr = <unsafe byte>p;
    for (var i = 0; i < len *t; i = i + 1) {
      var pg = (*t)[i];
      if (addr >= pg.virtual_address && addr < pg.virtual_address + pg.size) {
        return <unsafe * byte>(pg.physical_address + (addr - pg.virtual_address));
      }
    }
    return null;
  }

  function init(): void {
    log('memory: initializing...');

    // Calculate memory layout
    // Kernel heap sits at the end of kernel reserved space
    kernel_heap_base = KERNEL_RESERVED - KERNEL_HEAP_SIZE;
    kernel_heap_current = 0;

    // User pool starts after kernel reserved space
    user_pool_base = KERNEL_RESERVED;
    user_pool_current = 0;
    user_pool_size = TOTAL_PHYSICAL_MEMORY - KERNEL_RESERVED;

    log('memory: kernel heap base');
    log('memory: user pool base');
    log('memory: user pool size');

    // Initialize MMU peripheral
    mmu_base_address = <unsafe * byte>kernel::peripherals::mmu;
    if (!mmu_base_address) {
      panic('memory: mmu not mapped');
    }

    // Start with MMU disabled (no page table)
    use_table(null);

    log('memory: initialized');
  }
}

