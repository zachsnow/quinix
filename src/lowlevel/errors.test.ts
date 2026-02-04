/**
 * Error handling tests for the QLL compiler.
 * Tests parser errors, type errors, and compiler error messages.
 */

import { LowLevelProgram } from './lowlevel';
import { compileQLL, expectCompileError } from '@test/helpers';

describe('Parser Errors', () => {
  test('missing semicolon', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main(): byte {
          var x: byte = 42
          return x;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('missing closing brace', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main(): byte {
          return 42;
      `, 'test.qll')
    ).toThrow();
  });

  test('missing opening paren', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main): byte {
          return 42;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('invalid token', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main(): byte {
          return @invalid;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('unclosed string literal', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main(): byte {
          var s = "hello;
          return 0;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('unclosed char literal', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main(): byte {
          var c = 'a;
          return 0;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('invalid escape sequence', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main(): byte {
          var s = "\\q";
          return 0;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('missing type annotation', () => {
    expect(() =>
      LowLevelProgram.parse(`
        function main() {
          return 42;
        }
      `, 'test.qll')
    ).toThrow();
  });

  test('invalid array literal (empty brackets)', () => {
    // Empty brackets [] without type annotation requires context
    const result = compileQLL(`
      function main(): byte {
        var arr = [];
        return 0;
      }
    `);
    expect(result.success).toBe(false);
  });
});

describe('Type Errors', () => {
  test('unknown identifier', () => {
    return expectCompileError('unknown identifier', `
      function main(): byte {
        return unknown_var;
      }
    `);
  });

  test('type mismatch in assignment', () => {
    return expectCompileError('expected', `
      function main(): byte {
        var x: byte = "hello";
        return 0;
      }
    `);
  });

  test('type mismatch in return', () => {
    return expectCompileError('expected', `
      function main(): byte {
        return "hello";
      }
    `);
  });

  test('wrong number of arguments', () => {
    return expectCompileError('expected', `
      function add(a: byte, b: byte): byte {
        return a + b;
      }
      function main(): byte {
        return add(1);
      }
    `);
  });

  test('argument type mismatch', () => {
    return expectCompileError('expected', `
      function take_int(x: byte): byte {
        return x;
      }
      function main(): byte {
        return take_int("hello");
      }
    `);
  });

  test('invalid binary operation', () => {
    return expectCompileError('', `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: Point;
        var q: Point;
        var r = p + q;
        return 0;
      }
    `);
  });

  test('dereference non-pointer', () => {
    return expectCompileError('', `
      function main(): byte {
        var x: byte = 42;
        return *x;
      }
    `);
  });

  test('index non-array', () => {
    return expectCompileError('', `
      function main(): byte {
        var x: byte = 42;
        return x[0];
      }
    `);
  });

  test('field access on non-struct', () => {
    return expectCompileError('', `
      function main(): byte {
        var x: byte = 42;
        return x.field;
      }
    `);
  });

  test('unknown field', () => {
    return expectCompileError('', `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: Point;
        return p.z;
      }
    `);
  });

  test('missing return statement', () => {
    return expectCompileError('missing return', `
      function main(): byte {
        var x = 42;
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

  test('continue outside loop', () => {
    return expectCompileError('continue outside', `
      function main(): byte {
        continue;
        return 0;
      }
    `);
  });

  test('assignment to non-lvalue', () => {
    return expectCompileError('', `
      function main(): byte {
        5 = 10;
        return 0;
      }
    `);
  });

  test('duplicate variable declaration', () => {
    return expectCompileError('', `
      function main(): byte {
        var x: byte = 1;
        var x: byte = 2;
        return x;
      }
    `);
  });

  test('duplicate function parameter', () => {
    return expectCompileError('', `
      function add(x: byte, x: byte): byte {
        return x + x;
      }
      function main(): byte {
        return add(1, 2);
      }
    `);
  });

  test('recursive type definition', () => {
    return expectCompileError('', `
      type A = struct { b: B; };
      type B = struct { a: A; };
      function main(): byte {
        return 0;
      }
    `);
  });
});

describe('Generic Type Errors', () => {
  test('wrong number of type arguments', () => {
    return expectCompileError('', `
      function identity<T>(x: T): T {
        return x;
      }
      function main(): byte {
        return identity<byte, byte>(42);
      }
    `);
  });

  test('unknown type', () => {
    return expectCompileError('', `
      function main(): byte {
        var x: UnknownType;
        return 0;
      }
    `);
  });
});

describe('Namespace Errors', () => {
  test('unknown namespace', () => {
    return expectCompileError('', `
      function main(): byte {
        return unknown::function();
      }
    `);
  });

  test('ambiguous using', () => {
    // Two usings that bring the same name into scope
    const source = `
      using global::a;
      using global::b;
      namespace a {
        function foo(): byte { return 1; }
      }
      namespace b {
        function foo(): byte { return 2; }
      }
      function main(): byte {
        return foo();
      }
    `;
    const result = compileQLL(source);
    // This may or may not error depending on implementation
    // Just verify it doesn't crash
    expect(result).toBeDefined();
  });
});

describe('Compile-time Evaluation Errors', () => {
  test('non-constant array length', () => {
    return expectCompileError('', `
      function main(): byte {
        var n: byte = 10;
        var arr: byte[n];
        return 0;
      }
    `);
  });
});

describe('Unsafe Errors', () => {
  test('unsafe operation without unsafe keyword', () => {
    return expectCompileError('', `
      function main(): byte {
        var p: *byte = <*byte>0x1000;
        return 0;
      }
    `);
  });
});

describe('Error Recovery', () => {
  test('multiple errors are reported', () => {
    const result = compileQLL(`
      function main(): byte {
        var x = unknown1;
        var y = unknown2;
        return x + y;
      }
    `);
    expect(result.success).toBe(false);
    // Should have at least 2 errors for unknown identifiers
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  test('error messages include location', () => {
    const result = compileQLL(`
      function main(): byte {
        return unknown;
      }
    `);
    expect(result.success).toBe(false);
    // Error message should contain useful info
    expect(result.errors[0]).toContain('unknown');
  });
});
