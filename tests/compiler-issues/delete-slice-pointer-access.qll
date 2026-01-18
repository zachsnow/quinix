// Test: Delete on slice accessed through pointer (->)
//
// Tests that we can delete a slice field accessed through a pointer.

type container = struct {
  data: byte[];
  id: byte;
};

function test_pointer_access_delete(): byte {
  // Allocate container on heap
  var c: * container = new container = container {
    data = new byte[15],
    id = 42,
  };

  // Verify allocation
  if (len c->data != 15) {
    return 1;  // Wrong length
  }

  if (c->id != 42) {
    return 2;  // Wrong id
  }

  // Delete the slice through pointer access
  delete c->data;

  // Verify it's zeroed
  if (len c->data != 0) {
    return 3;  // Length should be 0
  }

  if (cap c->data != 0) {
    return 4;  // Capacity should be 0
  }

  // Other fields should be unaffected
  if (c->id != 42) {
    return 5;  // ID should still be 42
  }

  // Clean up the container itself
  delete c;

  return 0;  // Success
}

function main(): byte {
  return test_pointer_access_delete();
}
