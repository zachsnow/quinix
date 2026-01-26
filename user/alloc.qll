// Userspace allocator wrapper.
// Sets heap to 0x3000 (virtual heap address) and provides system::alloc/dealloc.
namespace system {
  function _ensure_heap(): void {
    if (!std::heap) {
      std::heap = <unsafe * byte>0x3000;
    }
  }

  .export function alloc(size: byte): * byte {
    _ensure_heap();
    return std::alloc(size);
  }

  .export function dealloc(pointer: * byte): void {
    _ensure_heap();
    std::dealloc(pointer);
  }
}
