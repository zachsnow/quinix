// Console IO for programs running under the Quinix kernel.
namespace std::console {
  function print(s: string): bool {
    return lib::print(s);
  }

  function input(s: string): bool {
    return lib::input(s);
  }
}
