///////////////////////////////////////////////////////////////////////
// The Quinix system runtime.
///////////////////////////////////////////////////////////////////////
global HEAP_SIZE: .constant byte = 0x2000;
global SPLIT_THRESHOLD: .constant byte = 0x100;

global heap: * byte = <unsafe * byte> 0x8000;

type block = struct {
  allocated: bool;
  size: byte;
  next: * block;
};

global blocks: * block = null;

// Initialize the first block.
function _init(): void {
  blocks = <unsafe * block> heap;
  *blocks = block {
    allocated = false,
    size = HEAP_SIZE - sizeof block,
    next = <* block>null,
  };
}

// Merge free blocks.
function _merge_blocks(): void {
  var initial_block: * block = null;
  for(var block = blocks; !!block; block = block->next){
    if(!block->allocated){
      if(initial_block){
        initial_block->next = block->next;
        initial_block->size = initial_block->size + sizeof block + block->size;
      }
      else {
        initial_block = block;
      }
    }
    else {
      initial_block = null;
    }
  }
}

// Allocate the given number of bytes.
function alloc(size: byte): * byte {
  if(!blocks){
    _init();
  }

  // Find a free block that will fit.
  var free_block: * block = null;
  for(var block = blocks; !!block; block = block->next){
    if(!block->allocated && block->size >= size){
      free_block = block;
      break;
    }
  }

  // No free block found.
  if(!free_block){
    return <* byte>null;
  }

  // Allocate block.
  free_block->allocated = true;

  var ptr = <unsafe *byte>(<unsafe byte>free_block + sizeof block);

  // If there's enough excess space in the block, split it.
  if(free_block->size - size > sizeof block + SPLIT_THRESHOLD){
    var split_block = <unsafe * block>(<unsafe byte>ptr + size);

    split_block->allocated = false;
    split_block->size = free_block->size - size - sizeof block;
    split_block->next = free_block->next;

    free_block->size = size;
    free_block->next = split_block;
  }

  return ptr;
}

// Deallocate the given pointer.
function dealloc(pointer: * byte): void {
  if(!pointer){
    return;
  }

  var block = <unsafe * block>(<unsafe byte>pointer - sizeof block);
  block->allocated = false;

  _merge_blocks();
}
