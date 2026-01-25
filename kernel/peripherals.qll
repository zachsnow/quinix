///////////////////////////////////////////////////////////////////////
// Peripherals.
///////////////////////////////////////////////////////////////////////
namespace kernel {
  namespace peripherals {
    //
    // Hardware peripherals.
    //
    type peripheral_table_entry = struct {
        identifier: byte;
        address: * byte;
    };

    // VM peripheral table is at 0x0200 (see vm.ts:175)
    // Layout: [count: byte][entry0: peripheral_table_entry][entry1: ...]...
    // We access this directly via pointer arithmetic since it's a hardware-defined layout.
    .constant global peripheral_table_base: * byte = <unsafe * byte>0x0200;
    .constant global peripheral_table_data: * peripheral_table_entry = <unsafe * peripheral_table_entry>0x0201;

    //
    // Hardware timer.
    //
    .constant global timer_identifier: byte = 0x1;
    global timer: * byte = null;

    function _init_timer(entry: * peripheral_table_entry): void {
      timer = entry->address;
    }

    //
    // Debug output.
    //
    .constant global debug_output_identifier: byte = 0x3;
    global debug_output: * buffered_peripheral = null;

    function _init_debug_output(entry: * peripheral_table_entry): void {
      debug_output = <unsafe * buffered_peripheral>entry->address;
    }

    //
    // Debug input.
    //
    .constant global debug_input_identifier: byte = 0x4;
    global debug_input: * buffered_peripheral = null;

    function _init_debug_input(entry: * peripheral_table_entry): void {
      debug_input = <unsafe * buffered_peripheral>entry->address;
    }

    //
    // Debug file access.
    //
    .constant global debug_file_identifier: byte = 0x11;
    global debug_file: * buffered_peripheral = null;

    function _init_debug_file(entry: * peripheral_table_entry): void {
      debug_file = <unsafe * buffered_peripheral>entry->address;
    }

    //
    // MMU.
    //
    global mmu_identifier: byte = 0x80000002;
    global mmu: * byte = null;

    function _init_mmu(entry: * peripheral_table_entry): void {
      mmu = entry->address;
    }

    //
    // Block device.
    //
    .constant global block_device_identifier: byte = 0x20;

    function _init_block_device(entry: * peripheral_table_entry): void {
      kernel::block::init(entry);
    }

    //
    // Peripheral initialization.
    //
    type init_table_entry = struct {
      identifier: byte;
      init: (* peripheral_table_entry) => void;
    };

    global init_table: init_table_entry[] = [
      init_table_entry {
        identifier = timer_identifier,
        init = _init_timer,
      },
      init_table_entry {
        identifier = debug_output_identifier,
        init = _init_debug_output,
      },
      init_table_entry {
        identifier = debug_input_identifier,
        init = _init_debug_input,
      },
      init_table_entry {
        identifier = debug_file_identifier,
        init = _init_debug_file,
      },
      init_table_entry {
        identifier = mmu_identifier,
        init = _init_mmu,
      },
      init_table_entry {
        identifier = block_device_identifier,
        init = _init_block_device,
      },
    ];

    // Find and initialize the peripheral.
    // Uses unsafe pointer indexing because the peripheral table
    // is a hardware-defined memory layout.
    function init_peripheral(entry: init_table_entry): void {
      var count = *peripheral_table_base;
      for (var i: byte = 0; i < count; i = i + 1) {
        var p = &peripheral_table_data[unsafe i];
        if (p->identifier == entry.identifier) {
          (entry.init)(p);
          return;
        }
      }
      kernel::panic('peripherals: peripheral not found.');
    }

    //
    // Buffered peripherals.
    //
    type buffered_peripheral = struct {
      control: byte;
      capacity: byte;
      size: byte;
      buffer: byte[0];
    };

    function init(): void {
      // Initialize all peripherals.
      for(var i = 0; i < len init_table; i = i + 1){
        var entry = init_table[i];
        init_peripheral(entry);
      }
    }
  }
}
