// Test: Error on non-l-value slice expression
//
// Tests that we get a compile error when trying to delete a non-assignable slice.
// This should fail to compile with: "cannot delete non-assignable slice expression"

function get_array(): byte[] {
  return new byte[10];
}

function main(): byte {
  // This should be a compile error - can"t delete a temporary
  delete get_array();

  return 0;
}
