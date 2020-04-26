///////////////////////////////////////////////////////////////////////
// A simplified Quinix system runtime implementing a simple
// bump-allocator with no support for deallocation.
///////////////////////////////////////////////////////////////////////
global heap: * byte = <* byte> 0x8000;

function alloc(size: byte): * byte {
  var ptr = heap;
  heap = <* byte>(<byte>heap + size);
  return ptr;
}

function dealloc(pointer: * byte): void {
  return;
}
