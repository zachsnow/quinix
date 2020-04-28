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

    global peripheral_table: peripheral_table_entry[] = <unsafe peripheral_table_entry[]> 0x0100;

    //
    // Debug output.
    //
    global debug_output_identifier: byte = 0x1;
    global debug_output_ptr: * buffered_peripheral = 0x0;

    function _init_debug_output(entry: * peripheral_table_entry): void {
      debug_output_ptr = <* buffered_peripheral>entry->address;
    }

    //
    // Debug input.
    //
    global debug_input_identifier: byte = 0x2;
    global debug_input_ptr: * buffered_peripheral = 0x0;

    function _init_debug_input(entry: * peripheral_table_entry): void {
      debug_input_ptr = <* buffered_peripheral>entry->address;
    }

    //
    // Hardware timer.
    global timer_identifier: byte = 0x10;
    global timer_ptr: * byte = 0x0;

    function _init_timer(entry: * peripheral_table_entry): void {
      timer_ptr = entry->address;
    }

    //
    // Peripheral initialization.
    //
    type init_table_entry = struct {
      identifier: byte;
      init: (* byte) => void;
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
      }
    ];

    // Find and initialize the peripheral.
    function init_peripheral(entry: init_table_entry): void{
      for(var i = 0; i < len peripherals_table; i = i + 1){
        var peripheral = peripherals_table[i];
        if(peripheral.identifier == entry.identifier){
          (entry.init)();
        }
      }
      kernel::panic('Peripheral not found.');
    }

    type buffered_peripheral = struct {
      control: byte;
      buffer: byte;
    };

    function buffered_write(peripheral: * buffered_peripheral, data: byte[]): byte {

    }

    function init(): void {
      // Initialize all peripherals.
      for(var i = 0; i < len init_table; i = i + 1){
        var entry = init_table[i];
        init_peripheral(entry);
      }
    }
  }
}
