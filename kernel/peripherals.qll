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

    .constant global peripheral_table: peripheral_table_entry[] = <unsafe peripheral_table_entry[]> 0x0100;

    //
    // Debug output.
    //
    .constant global debug_output_identifier: byte = 0x1;
    .constant global debug_output_ptr: * buffered_peripheral = null;

    function _init_debug_output(entry: * peripheral_table_entry): void {
      debug_output_ptr = <unsafe * buffered_peripheral>entry->address;
    }

    //
    // Debug input.
    //
    global debug_input_identifier: byte = 0x2;
    global debug_input_ptr: * buffered_peripheral = null;

    function _init_debug_input(entry: * peripheral_table_entry): void {
      debug_input_ptr = <unsafe * buffered_peripheral>entry->address;
    }

    //
    // Debug file acccess.
    //
    global debug_file_identifier: byte = 0x11;
    global debug_file_ptr: * buffered_peripheral = null;

    function _init_debug_file(entry: * peripheral_table_entry): void {
      debug_file_ptr = <unsafe * buffered_peripheral>entry->address;
    }

    //
    // Hardware timer.
    global timer_identifier: byte = 0x10;
    global timer_ptr: * byte = null;

    function _init_timer(entry: * peripheral_table_entry): void {
      timer_ptr = entry->address;
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
        identifier = debug_output_identifier,
        init = _init_debug_output,
      },
      init_table_entry {
        identifier = debug_input_identifier,
        init = _init_debug_input,
      },
      init_table_entry {
        identifier = timer_identifier,
        init = _init_timer,
      },
      init_table_entry {
        identifier = debug_file_identifier,
        init = _init_debug_file,
      }
    ];

    // Find and initialize the peripheral.
    function init_peripheral(entry: init_table_entry): void{
      for(var i = 0; i < len peripheral_table; i = i + 1){
        var peripheral = peripheral_table[i];
        if(peripheral.identifier == entry.identifier){
          (entry.init)(&peripheral);
        }
      }
      kernel::panic('peripherals: peripheral not found.');
    }

    //
    // Buffered peripherals.
    //
    type buffered_peripheral = struct {
      control: byte;
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
