// Type conversion test: * T[N] → T[]
//
// This test verifies that pointers to sized arrays (* T[N]) are automatically
// converted to slices (T[]) in the following contexts:
// 1. Variable assignment with type annotation
// 2. Function call arguments
// 3. Function return values
// 4. Struct literal member initialization
//
// Expected: Should compile and run successfully, returning 0

type container = struct {
  data: byte[];
};

function takes_slice(s: byte[]): byte {
  // Slices should have their length properly set
  if (len s == 0) {
    return 1;
  }
  return 0;
}

function returns_array(): byte[] {
  // Return statement should convert * byte[15] → byte[]
  return new byte[15];
}

function test_conversions(): byte {
  // Test 1: Variable assignment conversion
  // new byte[10] returns * byte[10], which is converted to byte[]
  var arr1: byte[] = new byte[10];
  if (takes_slice(arr1) != 0) {
    return 1;
  }

  // Test 2: Function argument conversion
  // arr2 has type * byte[20], but takes_slice expects byte[]
  var arr2 = new byte[20];
  if (takes_slice(arr2) != 0) {
    return 2;
  }

  // Test 3: Struct member initialization conversion
  var c = container {
    data = new byte[30],
  };
  if (takes_slice(c.data) != 0) {
    return 3;
  }

  // Test 4: Return value conversion
  var arr3 = returns_array();
  if (takes_slice(arr3) != 0) {
    return 4;
  }

  // Test 5: Pointer negation (original issue #2)
  // new byte[40] returns * byte[40], which is an integral type and can be negated
  var arr4 = new byte[40];
  if (!arr4) {
    return 5;
  }

  return 0;
}

function main(): byte {
  return test_conversions();
}
