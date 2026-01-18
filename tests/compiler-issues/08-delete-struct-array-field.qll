// Issue #8: Delete on Struct Array Fields
//
// Expected: Should compile successfully
// Actual: Error - expected array or pointer type, actual page[]

type page = struct {
  virtual_address: byte;
  physical_address: byte;
  size: byte;
};

type table = struct {
  pages: page[];
};

function create_table(): * table {
  var pages = new page[] = [
    page {
      virtual_address = 0x1000,
      physical_address = 0x2000,
      size = 0x1000,
    },
  ];

  return new table = table {
    pages = pages,
  };
}

function destroy_table(t: * table): void {
  delete t->pages;  // ERROR: expected array or pointer type, actual page[]
  delete t;
}

function main(): byte {
  var t = create_table();
  destroy_table(t);
  return 0;
}
