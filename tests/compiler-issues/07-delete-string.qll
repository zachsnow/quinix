// Issue #7: Delete on Strings
//
// Expected: Should compile successfully
// Actual: Error - expected array or pointer type, actual string

type file = struct {
  path: string;
  handle: byte;
};

function create_file(path: string): file {
  // Copy the string
  var path_copy: byte[] = new byte[len path];
  for(var i = 0; i < len path; i = i + 1){
    path_copy[i] = path[i];
  }

  return file {
    path = <string>path_copy,
    handle = 1,
  };
}

function destroy_file(f: * file): void {
  delete f->path;  // Now works!
}

function main(): byte {
  var f = create_file("test.txt");
  destroy_file(&f);
  return 0;
}
