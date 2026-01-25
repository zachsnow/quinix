// Test: Delete on strings
//
// This is issue #7 - delete on strings.
// String is convertible to byte[], so it should work with our slice delete.

type file = struct {
  path: string;
  handle: byte;
};

function string_copy(s: string): string {
  var copy: byte[] = new byte[len s];
  for (var i = 0; i < len s; i = i + 1) {
    copy[i] = s[i];
  }
  return <string>copy;
}

function create_file(path: string): file {
  return file {
    path = string_copy(path),
    handle = 42,
  };
}

function destroy_file(f: * file): void {
  delete f->path;  // This should now work!
}

function test_string_delete(): byte {
  var f = create_file("test.txt");

  // Verify it"s set up
  if (f.handle != 42) {
    return 1;  // Wrong handle
  }

  if (len f.path != 8) {
    return 2;  // "test.txt" should be 8 chars
  }

  // Delete the string
  destroy_file(&f);

  // Verify it"s zeroed
  if (len f.path != 0) {
    return 3;  // Length should be 0
  }

  if (cap f.path != 0) {
    return 4;  // Capacity should be 0
  }

  // Other fields should be unaffected
  if (f.handle != 42) {
    return 5;  // Handle should still be 42
  }

  return 0;  // Success
}

function main(): byte {
  return test_string_delete();
}
