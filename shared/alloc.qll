// Shared memory allocator.
// The heap pointer must be set before first allocation.
namespace std {
  .constant global HEAP_SIZE: byte = 0x2000;
  .constant global SPLIT_THRESHOLD: byte = 0x100;

  // Must be set by context (kernel, lib, bare) before first allocation.
  global heap: * byte = null;

  type block = struct {
    allocated: bool;
    size: byte;
    next: * block;
  };

  global blocks: * block = null;

  function _init_alloc(): void {
    blocks = <unsafe * block>heap;
    *blocks = block {
      allocated = false,
      size = HEAP_SIZE - sizeof block,
      next = null,
    };
  }

  function _merge_blocks(): void {
    var initial_block: * block = null;
    for (var b = blocks; !!b; b = b->next) {
      if (!b->allocated) {
        if (initial_block) {
          initial_block->next = b->next;
          initial_block->size = initial_block->size + sizeof block + b->size;
        }
        else {
          initial_block = b;
        }
      }
      else {
        initial_block = null;
      }
    }
  }

  function alloc(size: byte): * byte {
    if (!blocks) {
      _init_alloc();
    }

    // Find a free block that will fit.
    var free_block: * block = null;
    for (var b = blocks; !!b; b = b->next) {
      if (!b->allocated && b->size >= size) {
        free_block = b;
        break;
      }
    }

    // No free block found.
    if (!free_block) {
      return null;
    }

    // Allocate block.
    free_block->allocated = true;

    var ptr = <unsafe * byte>(<unsafe byte>free_block + sizeof block);

    // If there"s enough excess space in the block, split it.
    if (free_block->size - size > sizeof block + SPLIT_THRESHOLD) {
      var split_block = <unsafe * block>(<unsafe byte>ptr + size);

      split_block->allocated = false;
      split_block->size = free_block->size - size - sizeof block;
      split_block->next = free_block->next;

      free_block->size = size;
      free_block->next = split_block;
    }

    return ptr;
  }

  function dealloc(pointer: * byte): void {
    if (!pointer) {
      return;
    }

    var b = <unsafe * block>(<unsafe byte>pointer - sizeof block);
    b->allocated = false;

    _merge_blocks();
  }
}
