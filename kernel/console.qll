// Kernel console using debug output peripheral directly.
namespace std::console {
  function print(s: string): bool {
    if (!kernel::peripherals::debug_output) {
      return false;
    }
    return std::buffered::write(
      &kernel::peripherals::debug_output->control,
      &kernel::peripherals::debug_output->size,
      kernel::peripherals::buffered_buffer(kernel::peripherals::debug_output),
      s
    );
  }
}
