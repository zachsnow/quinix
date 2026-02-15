/**
 * Standard library integration tests.
 * Tests the shared/std.qll and shared/alloc.qll functions.
 */

import { expectQLLWithStd, expectQLLOutput } from '@test/helpers';

describe('std::math', () => {
  test('max: first larger', () => {
    return expectQLLWithStd(10, `
      function main(): byte {
        return std::math::max(10, 5);
      }
    `);
  });

  test('max: second larger', () => {
    return expectQLLWithStd(15, `
      function main(): byte {
        return std::math::max(10, 15);
      }
    `);
  });

  test('max: equal', () => {
    return expectQLLWithStd(7, `
      function main(): byte {
        return std::math::max(7, 7);
      }
    `);
  });

  test('min: first smaller', () => {
    return expectQLLWithStd(5, `
      function main(): byte {
        return std::math::min(5, 10);
      }
    `);
  });

  test('min: second smaller', () => {
    return expectQLLWithStd(10, `
      function main(): byte {
        return std::math::min(15, 10);
      }
    `);
  });

  test('min: equal', () => {
    return expectQLLWithStd(7, `
      function main(): byte {
        return std::math::min(7, 7);
      }
    `);
  });
});

describe('std::str', () => {
  test('reverse: even length', () => {
    return expectQLLWithStd(0x64, `
      function main(): byte {
        var s: byte[4] = "abcd";
        std::str::reverse(s);
        return s[0];
      }
    `);
  });

  test('reverse: odd length', () => {
    return expectQLLWithStd(0x65, `
      function main(): byte {
        var s: byte[5] = "abcde";
        std::str::reverse(s);
        return s[0];
      }
    `);
  });

  test('reverse: single char', () => {
    return expectQLLWithStd(0x61, `
      function main(): byte {
        var s: byte[1] = "a";
        std::str::reverse(s);
        return s[0];
      }
    `);
  });

  test('itoa: positive number', () => {
    return expectQLLWithStd(0x34, `
      function main(): byte {
        var n: int = 42;
        var buffer: byte[16];
        std::str::itoa(n, buffer, 10);
        return buffer[0];
      }
    `, { cycles: 10000 });
  });

  test('itoa: zero', () => {
    return expectQLLWithStd(0x30, `
      function main(): byte {
        var n: int = 0;
        var buffer: byte[16];
        std::str::itoa(n, buffer, 10);
        return buffer[0];
      }
    `, { cycles: 10000 });
  });

  test('itoa: multi-digit number', () => {
    return expectQLLWithStd(0x31, `
      function main(): byte {
        var n: int = 123;
        var buffer: byte[16];
        std::str::itoa(n, buffer, 10);
        return buffer[0];
      }
    `, { cycles: 10000 });
  });

  test('itoa: negative number', () => {
    return expectQLLWithStd(0x2D, `
      function main(): byte {
        var n: int = -42;
        var buffer: byte[16];
        std::str::itoa(n, buffer, 10);
        return buffer[0];
      }
    `, { cycles: 10000 });
  });

  test('utoa: hex format', () => {
    return expectQLLWithStd(0x66, `
      function main(): byte {
        var buffer: byte[16];
        std::str::utoa(255, buffer, 16);
        return buffer[0];
      }
    `, { cycles: 10000 });
  });

  test('equal: matching strings', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var a: byte[5] = "hello";
        var b: byte[5] = "hello";
        return std::str::equal(a, b) ? 1 : 0;
      }
    `);
  });

  test('equal: different strings', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var a: byte[5] = "hello";
        var b: byte[5] = "world";
        return std::str::equal(a, b) ? 1 : 0;
      }
    `);
  });

  test('equal: different lengths', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var a: byte[2] = "hi";
        var b: byte[5] = "hello";
        return std::str::equal(a, b) ? 1 : 0;
      }
    `);
  });

  test('index_of: found', () => {
    return expectQLLWithStd(2, `
      function main(): byte {
        var s: byte[5] = "hello";
        return std::str::index_of(s, 0x6C);
      }
    `, { cycles: 10000 });
  });

  test('index_of: not found', () => {
    return expectQLLWithStd(-1, `
      function main(): byte {
        var s: byte[5] = "hello";
        return std::str::index_of(s, 0x7A);
      }
    `, { cycles: 10000 });
  });

  test('starts_with: match', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var s: byte[5] = "hello";
        var p: byte[3] = "hel";
        return std::str::starts_with(s, p) ? 1 : 0;
      }
    `, { cycles: 10000 });
  });

  test('starts_with: no match', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var s: byte[5] = "hello";
        var p: byte[3] = "wor";
        return std::str::starts_with(s, p) ? 1 : 0;
      }
    `, { cycles: 10000 });
  });

  test('ends_with: match', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var s: byte[5] = "hello";
        var p: byte[2] = "lo";
        return std::str::ends_with(s, p) ? 1 : 0;
      }
    `, { cycles: 10000 });
  });

  test('ends_with: no match', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var s: byte[5] = "hello";
        var p: byte[2] = "he";
        return std::str::ends_with(s, p) ? 1 : 0;
      }
    `, { cycles: 10000 });
  });

  test('to_upper', () => {
    return expectQLLWithStd(0x48, `
      function main(): byte {
        var s: byte[5] = "hello";
        std::str::to_upper(s);
        return s[0];
      }
    `, { cycles: 10000 });
  });

  test('to_lower', () => {
    return expectQLLWithStd(0x68, `
      function main(): byte {
        var s: byte[5] = "HELLO";
        std::str::to_lower(s);
        return s[0];
      }
    `, { cycles: 10000 });
  });

  test('concat', () => {
    return expectQLLOutput("abcd", `
      function main(): byte {
        var a: byte[2] = "ab";
        var b: byte[2] = "cd";
        var result: byte[] = std::str::concat(a, b);
        std::console::print(result);
        return 0;
      }
    `, { cycles: 20000 });
  });
});

describe('std::copy', () => {
  test('copy full array', () => {
    return expectQLLWithStd(30, `
      function main(): byte {
        var src: byte[3] = [10, 20, 30];
        var dst: byte[3];
        std::copy<byte>(dst, src);
        return dst[2];
      }
    `);
  });

  test('copy preserves data', () => {
    return expectQLLWithStd(20, `
      function main(): byte {
        var src: byte[3] = [10, 20, 30];
        var dst: byte[5];
        std::copy<byte>(dst, src);
        return dst[1];
      }
    `);
  });

  test('copy partial', () => {
    return expectQLLWithStd(2, `
      function main(): byte {
        var src: byte[5] = [1, 2, 3, 4, 5];
        var dst: byte[2];
        std::copy<byte>(dst, src);
        return dst[1];
      }
    `);
  });
});

describe('std::alloc', () => {
  test('alloc returns non-null', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var p = new byte;
        return !!p ? 1 : 0;
      }
    `, { cycles: 2000 });
  });

  test('alloc and write', () => {
    return expectQLLWithStd(42, `
      function main(): byte {
        var p = new byte = 42;
        return *p;
      }
    `, { cycles: 2000 });
  });

  test('multiple allocations return different addresses', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var p1 = new byte;
        var p2 = new byte;
        return p1 != p2 ? 1 : 0;
      }
    `, { cycles: 3000 });
  });

  test('dealloc and realloc', () => {
    return expectQLLWithStd(99, `
      function main(): byte {
        var p1 = new byte = 42;
        delete p1;
        var p2 = new byte = 99;
        return *p2;
      }
    `);
  });

  test('allocate array', () => {
    return expectQLLWithStd(5, `
      function main(): byte {
        var arr: byte[] = new byte[5];
        return len arr;
      }
    `, { cycles: 2000 });
  });

  test('allocate array with initializer', () => {
    return expectQLLWithStd(30, `
      function main(): byte {
        var arr: byte[] = new byte[] = [10, 20, 30];
        return arr[2];
      }
    `, { cycles: 2000 });
  });

  test('allocate struct', () => {
    return expectQLLWithStd(20, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p = new Point = Point { x = 10, y = 20 };
        return p->y;
      }
    `, { cycles: 2000 });
  });

  test('alloc returns null when out of memory', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var p = new byte[0x20000];
        return <unsafe byte>p;
      }
    `, { cycles: 2000 });
  });
});

describe('std::vector', () => {
  test('create empty vector', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        return len v;
      }
    `, { cycles: 3000 });
  });

  test('add to vector', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 42);
        return len v;
      }
    `);
  });

  test('add and access', () => {
    return expectQLLWithStd(42, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 42);
        return v[0];
      }
    `);
  });

  test('add multiple', () => {
    return expectQLLWithStd(3, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        std::vector::add(&v, 30);
        return len v;
      }
    `, { cycles: 8000 });
  });

  test('find existing element', () => {
    return expectQLLWithStd(1, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        std::vector::add(&v, 30);
        return std::vector::find(v, 20);
      }
    `, { cycles: 10000 });
  });

  test('find missing element returns -1', () => {
    return expectQLLWithStd(-1, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        return std::vector::find(v, 99);
      }
    `, { cycles: 8000 });
  });

  test('remove shifts elements', () => {
    return expectQLLWithStd(30, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add<byte>(&v, 10);
        std::vector::add<byte>(&v, 20);
        std::vector::add<byte>(&v, 30);
        std::vector::remove<byte>(&v, 1);
        return v[1];
      }
    `, { cycles: 10000 });
  });

  test('from_array', () => {
    return expectQLLWithStd(20, `
      function main(): byte {
        var arr: byte[3] = [10, 20, 30];
        var v = std::vector::from_array<byte>(arr);
        return v[1];
      }
    `, { cycles: 5000 });
  });

  test('destroy', () => {
    return expectQLLWithStd(0, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 42);
        std::vector::destroy<byte>(v);
        return 0;
      }
    `, { cycles: 5000 });
  });

  test('foreach', () => {
    return expectQLLWithStd(60, `
      global sum: byte = 0;
      function accumulate(n: byte): void {
        sum = sum + n;
      }
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        std::vector::add(&v, 30);
        std::vector::foreach<byte>(v, accumulate);
        return sum;
      }
    `, { cycles: 15000 });
  });
});

describe('std::ilist', () => {
  test('length of empty list', () => {
    return expectQLLWithStd(0, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        return std::ilist::length<*Node>(list);
      }
    `, { cycles: 3000 });
  });

  test('add to list', () => {
    return expectQLLWithStd(1, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        var n = new Node = Node { value = 42, next = null };
        std::ilist::add<*Node>(&list, n);
        return std::ilist::length<*Node>(list);
      }
    `);
  });

  test('add multiple to list', () => {
    return expectQLLWithStd(3, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        var n1 = new Node = Node { value = 10, next = null };
        var n2 = new Node = Node { value = 20, next = null };
        var n3 = new Node = Node { value = 30, next = null };
        std::ilist::add<*Node>(&list, n1);
        std::ilist::add<*Node>(&list, n2);
        std::ilist::add<*Node>(&list, n3);
        return std::ilist::length<*Node>(list);
      }
    `, { cycles: 10000 });
  });

  test('access list element', () => {
    return expectQLLWithStd(42, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        var n = new Node = Node { value = 42, next = null };
        std::ilist::add<*Node>(&list, n);
        return list->value;
      }
    `);
  });

  test('remove from list', () => {
    return expectQLLWithStd(2, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        var n1 = new Node = Node { value = 10, next = null };
        var n2 = new Node = Node { value = 20, next = null };
        var n3 = new Node = Node { value = 30, next = null };
        std::ilist::add<*Node>(&list, n1);
        std::ilist::add<*Node>(&list, n2);
        std::ilist::add<*Node>(&list, n3);
        std::ilist::remove<*Node>(&list, n2);
        return std::ilist::length<*Node>(list);
      }
    `, { cycles: 15000 });
  });

  test('foreach', () => {
    return expectQLLWithStd(30, `
      type Node = struct { value: byte; next: *Node; };
      global sum: byte = 0;
      function accumulate(node: *Node): void {
        sum = sum + node->value;
      }
      function main(): byte {
        var list: *Node = null;
        var n1 = new Node = Node { value = 10, next = null };
        var n2 = new Node = Node { value = 20, next = null };
        std::ilist::add<*Node>(&list, n1);
        std::ilist::add<*Node>(&list, n2);
        std::ilist::foreach<*Node>(list, accumulate);
        return sum;
      }
    `, { cycles: 15000 });
  });
});

describe('std::slice type', () => {
  test('slice struct has correct size', () => {
    return expectQLLWithStd(3, `
      function main(): byte {
        return sizeof std::slice<byte>;
      }
    `);
  });
});

describe('std::fmt', () => {
  test('print with fs', () => {
    return expectQLLOutput("hello", `
      function main(): byte {
        var fmts: std::fmt[1];
        fmts[0] = std::fmt::fs("hello");
        std::fmt::print(fmts);
        return 0;
      }
    `, { cycles: 20000 });
  });

  test('print with fi', () => {
    return expectQLLOutput("42", `
      function main(): byte {
        var n: int = 42;
        var fmts: std::fmt[1];
        fmts[0] = std::fmt::fi(n);
        std::fmt::print(fmts);
        return 0;
      }
    `, { cycles: 30000 });
  });

  test('print with fi negative', () => {
    return expectQLLOutput("-7", `
      function main(): byte {
        var n: int = -7;
        var fmts: std::fmt[1];
        fmts[0] = std::fmt::fi(n);
        std::fmt::print(fmts);
        return 0;
      }
    `, { cycles: 30000 });
  });

  test('print with fu', () => {
    return expectQLLOutput("255", `
      function main(): byte {
        var fmts: std::fmt[1];
        fmts[0] = std::fmt::fu(255);
        std::fmt::print(fmts);
        return 0;
      }
    `, { cycles: 30000 });
  });
});

describe('std::buffered', () => {
  test('write via console::print', () => {
    return expectQLLOutput("hello", `
      function main(): byte {
        var s: byte[5] = "hello";
        std::console::print(s);
        return 0;
      }
    `, { cycles: 10000 });
  });
});
