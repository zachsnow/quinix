// Test: Delete on slice struct field
//
// Tests that we can delete a slice that's a member of a struct.
// This verifies the l-value handling works correctly.

type container = struct {
  data: byte[];
  count: byte;
};

function test_struct_field_delete(): byte {
  var c: container;

  // Allocate data
  c.data = new byte[20];
  c.count = 5;

  // Verify allocation
  if (len c.data != 20) {
    return 1;  // Wrong length
  }

  // Delete the slice field
  delete c.data;

  // Verify it's zeroed
  if (len c.data != 0) {
    return 2;  // Length should be 0
  }

  if (cap c.data != 0) {
    return 3;  // Capacity should be 0
  }

  // Other fields should be unaffected
  if (c.count != 5) {
    return 4;  // Count should still be 5
  }

  return 0;  // Success
}

function main(): byte {
  return test_struct_field_delete();
}
