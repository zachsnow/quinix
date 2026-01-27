// Userspace allocator wrapper.
// Sets heap to 0x4000 (virtual heap address) and provides system::alloc/dealloc.
// Must match kernel's memory layout: exec(0x1000, 8KB) + gap(4KB) + heap(0x4000)
namespace system {
  function _ensure_heap(): void {
    if (!std::heap) {
      std::heap = <unsafe * byte>0x4000;
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
