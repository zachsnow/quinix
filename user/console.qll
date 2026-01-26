// Userspace console using syscalls.
namespace std::console {
  function print(s: string): bool {
    return lib::print(s) >= 0;
  }

  function input(buffer: string): bool {
    return lib::input(buffer) >= 0;
  }
}
