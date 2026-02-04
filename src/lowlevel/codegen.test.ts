/**
 * Code generation unit tests for the QLL compiler.
 * Tests the compilation of statements, expressions, and control flow.
 */

import {
  expectQLL,
  expectExpr,
  expectCompileError,
  runQLL,
  compileQLL,
  compileQLLToBinary,
} from '@test/helpers';
import { Compiler } from './compiler';

describe('Codegen: Literals', () => {
  test('integer literal: 0', () => expectExpr('0', 0));
  test('integer literal: 42', () => expectExpr('42', 42));
  test('integer literal: -1', () => expectExpr('-1', -1));
  test('integer literal: hex', () => expectExpr('0xFF', 255));
  test('integer literal: max positive', () => expectExpr('0x7FFFFFFF', 0x7FFFFFFF));
  test('integer literal: max unsigned', () => expectExpr('0xFFFFFFFF', 0xFFFFFFFF));

  test('boolean literal: true', () => expectExpr('<byte>true', 1));
  test('boolean literal: false', () => expectExpr('<byte>false', 0));

  test('char literal', () => expectExpr("'A'", 65));
  test('char literal: escape', () => expectExpr("'\\n'", 10));

  test('string literal first char', () => {
    return expectQLL(72, `
      function main(): byte {
        var s = "Hello";
        return s[0];
      }
    `);
  });

  test('string literal length', () => {
    return expectQLL(5, `
      function main(): byte {
        return len "Hello";
      }
    `);
  });
});

describe('Codegen: Arithmetic', () => {
  test('add', () => expectExpr('10 + 5', 15));
  test('subtract', () => expectExpr('10 - 5', 5));
  test('multiply', () => expectExpr('10 * 5', 50));
  test('divide', () => expectExpr('10 / 5', 2));
  test('modulo', () => expectExpr('10 % 3', 1));

  test('unary minus', () => expectExpr('-42', -42));
  test('unary minus of expression', () => expectExpr('-(10 + 5)', -15));

  test('precedence: mul before add', () => expectExpr('2 + 3 * 4', 14));
  test('precedence: parens override', () => expectExpr('(2 + 3) * 4', 20));

  test('chained operations', () => expectExpr('1 + 2 + 3 + 4', 10));
  test('mixed operations', () => expectExpr('10 - 3 * 2 + 4 / 2', 6));

  test('overflow wraps', () => expectExpr('0xFFFFFFFF + 1', 0));
  test('underflow wraps', () => expectExpr('0 - 1', 0xFFFFFFFF));
});

describe('Codegen: Bitwise', () => {
  test('and', () => expectExpr('0xFF & 0x0F', 0x0F));
  test('or', () => expectExpr('0xF0 | 0x0F', 0xFF));
  test('shift left', () => expectExpr('1 << 4', 16));
  test('shift right', () => expectExpr('16 >> 2', 4));
});

describe('Codegen: Comparison', () => {
  test('eq true', () => expectExpr('<byte>(5 == 5)', 1));
  test('eq false', () => expectExpr('<byte>(5 == 6)', 0));
  test('neq true', () => expectExpr('<byte>(5 != 6)', 1));
  test('neq false', () => expectExpr('<byte>(5 != 5)', 0));
  test('lt true', () => expectExpr('<byte>(5 < 6)', 1));
  test('lt false', () => expectExpr('<byte>(6 < 5)', 0));
  test('lte true (less)', () => expectExpr('<byte>(5 <= 6)', 1));
  test('lte true (equal)', () => expectExpr('<byte>(5 <= 5)', 1));
  test('lte false', () => expectExpr('<byte>(6 <= 5)', 0));
  test('gt true', () => expectExpr('<byte>(6 > 5)', 1));
  test('gt false', () => expectExpr('<byte>(5 > 6)', 0));
  test('gte true (greater)', () => expectExpr('<byte>(6 >= 5)', 1));
  test('gte true (equal)', () => expectExpr('<byte>(5 >= 5)', 1));
  test('gte false', () => expectExpr('<byte>(5 >= 6)', 0));
});

describe('Codegen: Logical', () => {
  test('not: true -> false', () => expectExpr('<byte>!1', 0));
  test('not: false -> true', () => expectExpr('<byte>!0', 1));
  test('double not', () => expectExpr('<byte>!!42', 1));

  test('and: short-circuit false', () => {
    return expectQLL(0, `
      function main(): byte {
        return <byte>(0 && 42);
      }
    `);
  });

  test('and: evaluates both', () => {
    return expectQLL(42, `
      function main(): byte {
        return <byte>(1 && 42);
      }
    `);
  });

  test('or: short-circuit true', () => {
    return expectQLL(17, `
      function main(): byte {
        return <byte>(17 || 42);
      }
    `);
  });

  test('or: evaluates second', () => {
    return expectQLL(42, `
      function main(): byte {
        return <byte>(0 || 42);
      }
    `);
  });
});

describe('Codegen: Variables', () => {
  test('local variable declaration and use', () => {
    return expectQLL(42, `
      function main(): byte {
        var x: byte = 42;
        return x;
      }
    `);
  });

  test('local variable reassignment', () => {
    return expectQLL(100, `
      function main(): byte {
        var x: byte = 42;
        x = 100;
        return x;
      }
    `);
  });

  test('multiple locals', () => {
    return expectQLL(30, `
      function main(): byte {
        var a: byte = 10;
        var b: byte = 20;
        return a + b;
      }
    `);
  });

  test('local variable type inference', () => {
    return expectQLL(42, `
      function main(): byte {
        var x = 42;
        return x;
      }
    `);
  });

  test('variable in if block', () => {
    return expectQLL(20, `
      function main(): byte {
        var x: byte = 10;
        if (1) {
          var y: byte = 20;
          return y;
        }
        return x;
      }
    `);
  });

  test('global variable', () => {
    return expectQLL(99, `
      global g: byte = 99;
      function main(): byte {
        return g;
      }
    `);
  });

  test('global variable modification', () => {
    return expectQLL(50, `
      global g: byte = 99;
      function main(): byte {
        g = 50;
        return g;
      }
    `);
  });
});

describe('Codegen: Pointers', () => {
  test('address-of and dereference', () => {
    return expectQLL(42, `
      function main(): byte {
        var x: byte = 42;
        var p: *byte = &x;
        return *p;
      }
    `);
  });

  test('write through pointer', () => {
    return expectQLL(100, `
      function main(): byte {
        var x: byte = 42;
        var p: *byte = &x;
        *p = 100;
        return x;
      }
    `);
  });

  test('null pointer', () => {
    return expectQLL(0, `
      function main(): byte {
        var p: *byte = null;
        return <unsafe byte>p;
      }
    `);
  });

  test('null dereference triggers error', () => {
    return expectQLL(Compiler.NULL_ERROR, `
      function main(): byte {
        var p: *byte = null;
        *p = 42;
        return 0;
      }
    `);
  });

  test('pointer to array element', () => {
    return expectQLL(20, `
      function main(): byte {
        var arr: byte[3];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        var p: *byte = &arr[1];
        return *p;
      }
    `);
  });
});

describe('Codegen: Arrays', () => {
  test('stack array declaration', () => {
    return expectQLL(5, `
      function main(): byte {
        var arr: byte[5];
        return len arr;
      }
    `);
  });

  test('stack array indexing', () => {
    return expectQLL(42, `
      function main(): byte {
        var arr: byte[3];
        arr[1] = 42;
        return arr[1];
      }
    `);
  });

  test('array literal', () => {
    return expectQLL(30, `
      function main(): byte {
        var arr: byte[] = [10, 20, 30];
        return arr[2];
      }
    `);
  });

  test('array bounds check', () => {
    return expectQLL(Compiler.BOUNDS_ERROR, `
      function main(): byte {
        var arr: byte[3];
        return arr[5];
      }
    `);
  });

  test('array iteration', () => {
    return expectQLL(60, `
      function main(): byte {
        var arr: byte[3] = [10, 20, 30];
        var sum: byte = 0;
        for (var i = 0; i < 3; i = i + 1) {
          sum = sum + arr[i];
        }
        return sum;
      }
    `);
  });
});

describe('Codegen: Slices', () => {
  test('slice from array', () => {
    return expectQLL(3, `
      function main(): byte {
        var arr: byte[5];
        var s: byte[] = arr[1:4];
        return len s;
      }
    `);
  });

  test('slice access', () => {
    return expectQLL(30, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        arr[3] = 40;
        var s: byte[] = arr[1:4];
        return s[1];
      }
    `);
  });

  test('slice default lo', () => {
    return expectQLL(10, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        var s: byte[] = arr[:2];
        return s[0];
      }
    `);
  });

  test('slice default hi', () => {
    return expectQLL(50, `
      function main(): byte {
        var arr: byte[5];
        arr[2] = 30;
        arr[3] = 40;
        arr[4] = 50;
        var s: byte[] = arr[2:];
        return s[2];
      }
    `);
  });

  test('slice full', () => {
    return expectQLL(5, `
      function main(): byte {
        var arr: byte[5];
        var s: byte[] = arr[:];
        return len s;
      }
    `);
  });

  test('slice capacity', () => {
    return expectQLL(4, `
      function main(): byte {
        var arr: byte[5];
        var s: byte[] = arr[1:3];
        return cap s;
      }
    `);
  });
});

describe('Codegen: Structs', () => {
  test('struct declaration and field access', () => {
    return expectQLL(42, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: Point;
        p.x = 42;
        return p.x;
      }
    `);
  });

  test('struct literal', () => {
    return expectQLL(20, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p = Point { x = 10, y = 20 };
        return p.y;
      }
    `);
  });

  test('struct literal out of order', () => {
    return expectQLL(10, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p = Point { y = 20, x = 10 };
        return p.x;
      }
    `);
  });

  test('nested struct', () => {
    return expectQLL(42, `
      type Point = struct { x: byte; y: byte; };
      type Rect = struct { tl: Point; br: Point; };
      function main(): byte {
        var r: Rect;
        r.br.y = 42;
        return r.br.y;
      }
    `);
  });

  test('pointer to struct with arrow operator', () => {
    return expectQLL(42, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: Point;
        var ptr: *Point = &p;
        ptr->x = 42;
        return ptr->x;
      }
    `, { includeAllocator: false });
  });

  test('struct assignment', () => {
    return expectQLL(20, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p = Point { x = 10, y = 20 };
        var q: Point = p;
        return q.y;
      }
    `);
  });
});

describe('Codegen: Control Flow - If', () => {
  test('if true branch', () => {
    return expectQLL(1, `
      function main(): byte {
        if (1) {
          return 1;
        }
        return 0;
      }
    `);
  });

  test('if false branch', () => {
    return expectQLL(0, `
      function main(): byte {
        if (0) {
          return 1;
        }
        return 0;
      }
    `);
  });

  test('if-else: true branch', () => {
    return expectQLL(1, `
      function main(): byte {
        if (1) {
          return 1;
        } else {
          return 2;
        }
      }
    `);
  });

  test('if-else: false branch', () => {
    return expectQLL(2, `
      function main(): byte {
        if (0) {
          return 1;
        } else {
          return 2;
        }
      }
    `);
  });

  test('if-else if-else', () => {
    return expectQLL(2, `
      function main(): byte {
        var x = 5;
        if (x < 3) {
          return 1;
        } else if (x < 7) {
          return 2;
        } else {
          return 3;
        }
      }
    `);
  });

  test('nested if', () => {
    return expectQLL(42, `
      function main(): byte {
        if (1) {
          if (1) {
            return 42;
          }
        }
        return 0;
      }
    `);
  });
});

describe('Codegen: Control Flow - While', () => {
  test('while loop', () => {
    return expectQLL(5, `
      function main(): byte {
        var i = 0;
        while (i < 5) {
          i = i + 1;
        }
        return i;
      }
    `);
  });

  test('while break', () => {
    return expectQLL(3, `
      function main(): byte {
        var i = 0;
        while (i < 10) {
          i = i + 1;
          if (i == 3) {
            break;
          }
        }
        return i;
      }
    `);
  });

  test('while never enters', () => {
    return expectQLL(0, `
      function main(): byte {
        var i = 0;
        while (0) {
          i = i + 1;
        }
        return i;
      }
    `);
  });
});

describe('Codegen: Control Flow - For', () => {
  test('for loop', () => {
    return expectQLL(10, `
      function main(): byte {
        var sum = 0;
        for (var i = 0; i < 5; i = i + 1) {
          sum = sum + i;
        }
        return sum;
      }
    `);
  });

  test('for break', () => {
    return expectQLL(3, `
      function main(): byte {
        var sum = 0;
        for (var i = 0; i < 10; i = i + 1) {
          sum = sum + i;
          if (sum >= 3) {
            break;
          }
        }
        return sum;
      }
    `);
  });

  test('nested for loops', () => {
    return expectQLL(6, `
      function main(): byte {
        var sum = 0;
        for (var i = 0; i < 3; i = i + 1) {
          for (var j = 0; j < 2; j = j + 1) {
            sum = sum + 1;
          }
        }
        return sum;
      }
    `);
  });
});

describe('Codegen: Functions', () => {
  test('function call no args', () => {
    return expectQLL(42, `
      function answer(): byte {
        return 42;
      }
      function main(): byte {
        return answer();
      }
    `);
  });

  test('function call with args', () => {
    return expectQLL(7, `
      function add(a: byte, b: byte): byte {
        return a + b;
      }
      function main(): byte {
        return add(3, 4);
      }
    `);
  });

  test('function with local variables', () => {
    return expectQLL(15, `
      function compute(x: byte): byte {
        var doubled = x * 2;
        var extra = 5;
        return doubled + extra;
      }
      function main(): byte {
        return compute(5);
      }
    `);
  });

  test('recursive function', () => {
    return expectQLL(120, `
      function factorial(n: byte): byte {
        if (n <= 1) {
          return 1;
        }
        return n * factorial(n - 1);
      }
      function main(): byte {
        return factorial(5);
      }
    `, { cycles: 2000 });
  });

  test('mutual recursion', () => {
    return expectQLL(1, `
      function isEven(n: byte): byte {
        if (n == 0) { return 1; }
        return isOdd(n - 1);
      }
      function isOdd(n: byte): byte {
        if (n == 0) { return 0; }
        return isEven(n - 1);
      }
      function main(): byte {
        return isEven(4);
      }
    `, { cycles: 1000 });
  });

  test('function pointer', () => {
    return expectQLL(10, `
      type IntFn = () => byte;
      function ten(): byte { return 10; }
      function main(): byte {
        var fn: IntFn = ten;
        return fn();
      }
    `);
  });

  test('pass struct by value', () => {
    return expectQLL(30, `
      type Point = struct { x: byte; y: byte; };
      function sumPoint(p: Point): byte {
        return p.x + p.y;
      }
      function main(): byte {
        var p = Point { x = 10, y = 20 };
        return sumPoint(p);
      }
    `);
  });

  test('return struct', () => {
    return expectQLL(30, `
      type Point = struct { x: byte; y: byte; };
      function makePoint(x: byte, y: byte): Point {
        return Point { x = x, y = y };
      }
      function main(): byte {
        var p = makePoint(10, 20);
        return p.x + p.y;
      }
    `);
  });

  test('pass slice to function', () => {
    return expectQLL(3, `
      function getLen(s: byte[]): byte {
        return len s;
      }
      function main(): byte {
        var arr: byte[5];
        var s: byte[] = arr[:3];
        return getLen(s);
      }
    `);
  });
});

describe('Codegen: Namespaces', () => {
  test('namespace function call', () => {
    return expectQLL(42, `
      namespace math {
        function answer(): byte {
          return 42;
        }
      }
      function main(): byte {
        return math::answer();
      }
    `);
  });

  test('namespace global', () => {
    return expectQLL(99, `
      namespace constants {
        global value: byte = 99;
      }
      function main(): byte {
        return constants::value;
      }
    `);
  });

  test('nested namespace', () => {
    return expectQLL(42, `
      namespace outer {
        namespace inner {
          function get(): byte { return 42; }
        }
      }
      function main(): byte {
        return outer::inner::get();
      }
    `);
  });

  test('using directive', () => {
    return expectQLL(42, `
      using global::math;
      namespace math {
        function answer(): byte { return 42; }
      }
      function main(): byte {
        return answer();
      }
    `);
  });
});

describe('Codegen: Generics', () => {
  test('generic function', () => {
    return expectQLL(42, `
      function identity<T>(x: T): T {
        return x;
      }
      function main(): byte {
        return identity<byte>(42);
      }
    `);
  });

  test('generic function with multiple params', () => {
    return expectQLL(42, `
      function first<A, B>(a: A, b: B): A {
        return a;
      }
      function main(): byte {
        return first<byte, byte>(42, 0);
      }
    `);
  });
});

describe('Codegen: Type Casts', () => {
  test('cast byte to byte', () => expectExpr('<byte>42', 42));

  test('unsafe cast pointer to byte', () => {
    return expectQLL(0, `
      function main(): byte {
        var p: *byte = null;
        return <unsafe byte>p;
      }
    `);
  });
});

describe('Codegen: sizeof', () => {
  test('sizeof byte', () => expectExpr('sizeof byte', 1));

  test('sizeof slice', () => {
    // Slice is [pointer, length, capacity] = 3 words
    return expectQLL(3, `
      function main(): byte {
        return sizeof byte[];
      }
    `);
  });

  test('sizeof struct', () => {
    return expectQLL(2, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        return sizeof Point;
      }
    `);
  });

  test('sizeof nested struct', () => {
    return expectQLL(4, `
      type Point = struct { x: byte; y: byte; };
      type Line = struct { start: Point; end: Point; };
      function main(): byte {
        return sizeof Line;
      }
    `);
  });
});

describe('Codegen: Float', () => {
  test('float literal', () => {
    return expectQLL(3, `
      function main(): byte {
        return <byte>3.14f;
      }
    `);
  });

  test('float add', () => {
    return expectQLL(4, `
      function main(): byte {
        return <byte>(1.5f + 2.5f);
      }
    `);
  });

  test('float sub', () => {
    return expectQLL(3, `
      function main(): byte {
        return <byte>(5.0f - 2.0f);
      }
    `);
  });

  test('float mul', () => {
    return expectQLL(12, `
      function main(): byte {
        return <byte>(3.0f * 4.0f);
      }
    `);
  });

  test('float div', () => {
    return expectQLL(2, `
      function main(): byte {
        return <byte>(10.0f / 4.0f);
      }
    `);
  });

  test('float comparison', () => {
    return expectQLL(1, `
      function main(): byte {
        return <byte>(3.0f < 4.0f);
      }
    `);
  });

  test('float variable', () => {
    return expectQLL(5, `
      function main(): byte {
        var f: float = 2.5f;
        f = f + 2.5f;
        return <byte>f;
      }
    `);
  });

  test('int to float conversion', () => {
    return expectQLL(42, `
      function main(): byte {
        var f: float = <float>42;
        return <byte>f;
      }
    `);
  });
});

describe('Codegen: Compilation Errors', () => {
  test('unknown identifier', () => {
    return expectCompileError('unknown identifier', `
      function main(): byte {
        return unknown;
      }
    `);
  });

  test('type mismatch', () => {
    return expectCompileError('expected', `
      function main(): byte {
        var x: byte = "hello";
        return 0;
      }
    `);
  });

  test('break outside loop', () => {
    return expectCompileError('break outside', `
      function main(): byte {
        break;
        return 0;
      }
    `);
  });

  test('missing return', () => {
    return expectCompileError('missing return', `
      function main(): byte {
        var x = 42;
      }
    `);
  });
});
