// Simple test: Do type aliases work with null?

// Test 1: Alias to pointer type
type my_pointer = * byte;
global p1: my_pointer = null;  // Should work?

// Test 2: Alias to unsized array
type my_array = byte[];
global a1: my_array = null;  // Should work?

// Test 3: Alias to sized array
type my_sized_array = byte[10];
global a2: my_sized_array = null;  // Should NOT work (sized arrays aren"t nullable)

// Test 4: Generic alias to array
type vec<T> = T[];
global v1: vec<byte> = null;  // This is the issue!

function main(): byte {
  return 0;
}
