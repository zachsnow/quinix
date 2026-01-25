// Test: Double delete safety
//
// Tests that deleting a slice twice is safe.
// After the first delete, the pointer is null, so the second delete should be a no-op.

function test_double_delete(): byte {
  var arr: byte[] = new byte[10];

  // First delete
  delete arr;

  // Verify it"s zeroed
  if (len arr != 0) {
    return 1;  // Should be 0 after first delete
  }

  // Second delete - should be safe (deleting null pointer)
  delete arr;

  // Verify it"s still zeroed
  if (len arr != 0) {
    return 2;  // Should still be 0
  }

  if (cap arr != 0) {
    return 3;  // Should still be 0
  }

  return 0;  // Success - double delete is safe!
}

function main(): byte {
  return test_double_delete();
}
