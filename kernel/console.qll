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

  function input(buffer: byte[]): bool {
    if (!kernel::peripherals::debug_input) {
      return false;
    }
    return std::buffered::read(
      &kernel::peripherals::debug_input->control,
      &kernel::peripherals::debug_input->size,
      &kernel::peripherals::debug_input->buffer[unsafe 0],
      buffer
    );
  }
}
