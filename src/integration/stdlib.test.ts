/**
 * Standard library integration tests.
 * Tests the shared/std.qll and shared/alloc.qll functions.
 */

import fs from 'fs';
import path from 'path';

import { VM } from '@/vm/vm';
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { Immediate } from '@/lib/types';
import { PATHS, runQLL, expectQLL } from '@test/helpers';

const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Load standard library and all required dependencies
function loadStdLibProgram(): LowLevelProgram {
  const stdText = fs.readFileSync(PATHS.shared.std, 'utf-8');
  const allocText = fs.readFileSync(PATHS.shared.alloc, 'utf-8');
  const bufferedText = fs.readFileSync(path.join(ROOT_DIR, 'shared', 'buffered.qll'), 'utf-8');
  const bareAllocText = fs.readFileSync(PATHS.bare.alloc, 'utf-8');
  const bareWaitText = fs.readFileSync(path.join(ROOT_DIR, 'bare', 'wait.qll'), 'utf-8');
  const bareConsoleText = fs.readFileSync(path.join(ROOT_DIR, 'bare', 'console.qll'), 'utf-8');

  return LowLevelProgram.concat([
    LowLevelProgram.parse(bareWaitText, 'bare/wait.qll'),
    LowLevelProgram.parse(bufferedText, 'shared/buffered.qll'),
    LowLevelProgram.parse(stdText, PATHS.shared.std),
    LowLevelProgram.parse(allocText, PATHS.shared.alloc),
    LowLevelProgram.parse(bareAllocText, PATHS.bare.alloc),
    LowLevelProgram.parse(bareConsoleText, 'bare/console.qll'),
  ]);
}

function loadEntrypoint(): AssemblyProgram {
  const text = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
  return AssemblyProgram.parse(text, PATHS.bare.entrypoint);
}

async function runWithStdLib(source: string, cycles: number = 5000): Promise<number | string> {
  try {
    const stdLib = loadStdLibProgram();
    const userProgram = LowLevelProgram.parse(source, 'test.qll');
    const program = LowLevelProgram.concat([stdLib, userProgram]);

    const typeErrors = program.typecheck().errors;
    if (typeErrors.length) {
      return typeErrors.map(e => e.text).join('\n');
    }

    const entrypoint = loadEntrypoint();
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binaryProgram] = combined.assemble();

    if (!binaryProgram) {
      return messages.errors.map(e => e.text).join('\n');
    }

    const vm = new VM({ debug: true, cycles });
    return vm.run(binaryProgram.encode());
  } catch (e: any) {
    return e.location
      ? `${e.location.filename}(${e.location.start.line}): ${e.message}`
      : e.message;
  }
}

function expectStdLib(value: number, source: string, cycles: number = 5000) {
  return expect(
    runWithStdLib(source, cycles).then(n =>
      typeof n === 'string' ? n : Immediate.toString(n)
    )
  ).resolves.toBe(Immediate.toString(value));
}

describe('std::math', () => {
  test('max: first larger', () => {
    return expectStdLib(10, `
      function main(): byte {
        return std::math::max(10, 5);
      }
    `);
  });

  test('max: second larger', () => {
    return expectStdLib(15, `
      function main(): byte {
        return std::math::max(10, 15);
      }
    `);
  });

  test('max: equal', () => {
    return expectStdLib(7, `
      function main(): byte {
        return std::math::max(7, 7);
      }
    `);
  });

  test('min: first smaller', () => {
    return expectStdLib(5, `
      function main(): byte {
        return std::math::min(5, 10);
      }
    `);
  });

  test('min: second smaller', () => {
    return expectStdLib(10, `
      function main(): byte {
        return std::math::min(15, 10);
      }
    `);
  });

  test('min: equal', () => {
    return expectStdLib(7, `
      function main(): byte {
        return std::math::min(7, 7);
      }
    `);
  });
});

describe('std::str', () => {
  test('reverse: even length', () => {
    return expectStdLib(0x64, `
      function main(): byte {
        var s: byte[4] = "abcd";
        std::str::reverse(s);
        return s[0];
      }
    `);
  });

  test('reverse: odd length', () => {
    return expectStdLib(0x65, `
      function main(): byte {
        var s: byte[5] = "abcde";
        std::str::reverse(s);
        return s[0];
      }
    `);
  });

  test('reverse: single char', () => {
    return expectStdLib(0x61, `
      function main(): byte {
        var s: byte[1] = "a";
        std::str::reverse(s);
        return s[0];
      }
    `);
  });

  test('itoa: positive number', () => {
    return expectStdLib(0x34, `
      function main(): byte {
        var buffer: byte[16];
        std::str::itoa(42, buffer, 10);
        return buffer[0];
      }
    `, 10000);
  });

  test('itoa: zero', () => {
    return expectStdLib(0x30, `
      function main(): byte {
        var buffer: byte[16];
        std::str::itoa(0, buffer, 10);
        return buffer[0];
      }
    `, 10000);
  });

  test('itoa: multi-digit number', () => {
    // Test that multi-digit numbers are converted correctly (first digit of 123)
    return expectStdLib(0x31, `
      function main(): byte {
        var buffer: byte[16];
        std::str::itoa(123, buffer, 10);
        return buffer[0];
      }
    `, 10000);
  });

  test('utoa: hex format', () => {
    return expectStdLib(0x66, `
      function main(): byte {
        var buffer: byte[16];
        std::str::utoa(255, buffer, 16);
        return buffer[0];
      }
    `, 10000);
  });
});

describe('std::copy', () => {
  test('copy full array', () => {
    return expectStdLib(30, `
      function main(): byte {
        var src: byte[3] = [10, 20, 30];
        var dst: byte[3];
        std::copy<byte>(dst, src);
        return dst[2];
      }
    `);
  });

  test('copy preserves data', () => {
    return expectStdLib(20, `
      function main(): byte {
        var src: byte[3] = [10, 20, 30];
        var dst: byte[5];
        std::copy<byte>(dst, src);
        return dst[1];
      }
    `);
  });

  test('copy partial', () => {
    return expectStdLib(2, `
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
    return expectStdLib(1, `
      function main(): byte {
        var p = new byte;
        return !!p ? 1 : 0;
      }
    `, 2000);
  });

  test('alloc and write', () => {
    return expectStdLib(42, `
      function main(): byte {
        var p = new byte = 42;
        return *p;
      }
    `, 2000);
  });

  test('multiple allocations return different addresses', () => {
    return expectStdLib(1, `
      function main(): byte {
        var p1 = new byte;
        var p2 = new byte;
        return p1 != p2 ? 1 : 0;
      }
    `, 3000);
  });

  test('dealloc and realloc', () => {
    return expectStdLib(99, `
      function main(): byte {
        var p1 = new byte = 42;
        delete p1;
        var p2 = new byte = 99;
        return *p2;
      }
    `, 5000);
  });

  test('allocate array', () => {
    return expectStdLib(5, `
      function main(): byte {
        var arr: byte[] = new byte[5];
        return len arr;
      }
    `, 2000);
  });

  test('allocate array with initializer', () => {
    return expectStdLib(30, `
      function main(): byte {
        var arr: byte[] = new byte[] = [10, 20, 30];
        return arr[2];
      }
    `, 2000);
  });

  test('allocate struct', () => {
    return expectStdLib(20, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p = new Point = Point { x = 10, y = 20 };
        return p->y;
      }
    `, 2000);
  });

  test('alloc returns null when out of memory', () => {
    return expectStdLib(0, `
      function main(): byte {
        var p = new byte[0x20000];
        return <unsafe byte>p;
      }
    `, 2000);
  });
});

describe('std::vector', () => {
  test('create empty vector', () => {
    return expectStdLib(0, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        return len v;
      }
    `, 3000);
  });

  test('add to vector', () => {
    return expectStdLib(1, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 42);
        return len v;
      }
    `, 5000);
  });

  test('add and access', () => {
    return expectStdLib(42, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 42);
        return v[0];
      }
    `, 5000);
  });

  test('add multiple', () => {
    return expectStdLib(3, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        std::vector::add(&v, 30);
        return len v;
      }
    `, 8000);
  });

  test('find existing element', () => {
    return expectStdLib(1, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        std::vector::add(&v, 30);
        return std::vector::find(v, 20);
      }
    `, 10000);
  });

  test('find missing element returns -1', () => {
    return expectStdLib(-1, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add(&v, 10);
        std::vector::add(&v, 20);
        return std::vector::find(v, 99);
      }
    `, 8000);
  });

  test('remove shifts elements', () => {
    // After removing index 1 (value 20), v[1] should be 30
    return expectStdLib(30, `
      function main(): byte {
        var v = std::vector::create<byte>(10);
        std::vector::add<byte>(&v, 10);
        std::vector::add<byte>(&v, 20);
        std::vector::add<byte>(&v, 30);
        std::vector::remove<byte>(v, 1);
        return v[1];
      }
    `, 10000);
  });
});

describe('std::ilist', () => {
  test('length of empty list', () => {
    return expectStdLib(0, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        return std::ilist::length<*Node>(list);
      }
    `, 3000);
  });

  test('add to list', () => {
    return expectStdLib(1, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        var n = new Node = Node { value = 42, next = null };
        std::ilist::add<*Node>(&list, n);
        return std::ilist::length<*Node>(list);
      }
    `, 5000);
  });

  test('add multiple to list', () => {
    return expectStdLib(3, `
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
    `, 10000);
  });

  test('access list element', () => {
    return expectStdLib(42, `
      type Node = struct { value: byte; next: *Node; };
      function main(): byte {
        var list: *Node = null;
        var n = new Node = Node { value = 42, next = null };
        std::ilist::add<*Node>(&list, n);
        return list->value;
      }
    `, 5000);
  });

  test('remove from list', () => {
    return expectStdLib(2, `
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
    `, 15000);
  });
});

describe('std::slice type', () => {
  test('slice struct has correct size', () => {
    return expectStdLib(3, `
      function main(): byte {
        return sizeof std::slice<byte>;
      }
    `);
  });
});
