// Test: Basic delete on slice variable
//
// Tests that we can delete a slice, which should:
// 1. Free the heap memory
// 2. Zero out the slice descriptor (pointer, length, capacity)

function test_basic_delete(): byte {
  // Create a slice
  var arr: byte[] = new byte[10];

  // Verify it's allocated (check length)
  if (len arr != 10) {
    return 1;  // Wrong length
  }

  // Delete the slice
  delete arr;

  // After delete, the slice should be zeroed
  // Note: We can't directly check arr.pointer since slices don't have field access,
  // but we can verify the slice is now considered "empty"
  if (len arr != 0) {
    return 2;  // Length should be 0 after delete
  }

  if (cap arr != 0) {
    return 3;  // Capacity should be 0 after delete
  }

  return 0;  // Success
}

function main(): byte {
  return test_basic_delete();
}
