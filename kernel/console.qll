// Kernel console using debug output/input peripherals directly.
namespace std::console {
  function print(s: string): bool {
    if (!kernel::peripherals::debug_output) {
      return false;
    }
    return std::buffered::write(
      &kernel::peripherals::debug_output->control,
      &kernel::peripherals::debug_output->size,
      &kernel::peripherals::debug_output->buffer[unsafe 0],
      s
    );
  }

  // Read a line of input into buffer.
  // Returns: number of bytes read, or -1 on error.
  // Caller must set `len buffer = result` if needed.
  function input(buffer: string): byte {
    if (!kernel::peripherals::debug_input) {
      return -1;
    }
    return std::buffered::read(
      &kernel::peripherals::debug_input->control,
      &kernel::peripherals::debug_input->size,
      &kernel::peripherals::debug_input->buffer[unsafe 0],
      buffer
    );
  }
}
