import fs from 'fs';
import path from 'path';

import os from 'os';

import { LowLevelProgram } from './lowlevel';
import { Compiler } from './compiler';
import { parse as _parse } from './parser';
import { VM, VMResult } from '@/vm/vm';
import { DisplayPeripheral } from '@/vm/peripherals';
import { Immediate } from '@/lib/types';
import { AssemblyProgram } from '@/assembly/assembly';
import { createFileRenderer } from '@server/file-renderer';

describe('QLLC parsing', () => {
  function parseError(programText: string) {
    return () => {
      LowLevelProgram.parse(programText);
    };
  }

  describe('Syntax errors', () => {
    test('no return type', () => {
      expect(parseError(`
        function main(){
          return;
        }
      `)).toThrowError();
    });

    test('parse error includes filename and location', () => {
      try {
        LowLevelProgram.parse('function main(): byte { return @; }', 'test.qll');
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.location).toBeDefined();
        expect(e.location.filename).toBe('test.qll');
        expect(e.location.start.line).toBe(1);
        expect(e.location.start.column).toBeGreaterThan(0);
      }
    });

    test('parse error message is reasonable', () => {
      try {
        LowLevelProgram.parse('function f(): byte { return @; }', 'test.qll');
        expect(true).toBe(false);
      } catch (e: any) {
        // Should mention what was found
        expect(e.message).toContain('@');
      }
    });
  });

  describe('Comments and whitespace', () => {
    test('empty file', () => {
      expect(LowLevelProgram.parse('').declarations.length).toBe(0);
    });
    test('almost empty file', () => {
      expect(LowLevelProgram.parse('  \n  ').declarations.length).toBe(0);
    });
    test('comment only', () => {
      expect(LowLevelProgram.parse('// Hi!\n').declarations.length).toBe(0);
    });
    test('comment only no newline', () => {
      expect(LowLevelProgram.parse('// Hi!').declarations.length).toBe(0);
    });
    test('simple comments', () => {
      expect(LowLevelProgram.parse(`
        // Hi!
        type int = byte; // Yeah!
      `).declarations.length).toBe(1);
    });

    test('more simple comments', () => {
      expect(LowLevelProgram.parse(`
        // Hi!

        // And more.
        function f(): void {
          return 0;
        }
      `).declarations.length).toBe(1);
    });

    test('tagged types', () => {
      expect(LowLevelProgram.parse(`
        type constant_byte = .constant byte;
        type constant_fn = .constant (byte) => void;
        type return_constant = (byte) => .constant byte;

        type arbitrary_tags = .foo .bar .baz byte[];
        type Point = struct {
          x: .constant byte;
          y: .constant byte;
        };
      `).declarations.length).toBe(5);
    });

    test('template function', () => {
      expect(LowLevelProgram.parse(`
        function foo<T>(t: T): void {}
      `).declarations.length).toBe(1);
    });
  });
});

describe('QLLC typechecking', () => {
  function expectValid(programText: string) {
    const program: LowLevelProgram = LowLevelProgram.concat([LowLevelProgram.parse(programText)]);
    const messages = program.typecheck();
    if (messages.errors.length) {
      throw new Error(messages.toString());
    }
    expect(messages.errors.length).toBe(0);
  }

  function errors(programText: string): string[] {
    const program: LowLevelProgram = LowLevelProgram.parse(programText);
    try {
      return program.typecheck().errors.map((error) => error.text);
    }
    catch (e: any) {
      if (e.location) {
        return [e.message];
      }
      throw e;
    }
  }

  describe('Namespaces', () => {
    test('lookup global namespace', () => {
      return expectValid(`
        global t: byte = 34;
        function main(): byte {
          return t;
        }
      `);
    });

    test('lookup namespace', () => {
      return expectValid(`
        namespace n {
          global t: byte = 34;
        }
        function main(): byte {
          return n::t;
        }
      `);
    });

    test('lookup same namespace', () => {
      return expectValid(`
        namespace n {
          global t: byte = 34;
          function fn(): byte {
            return t;
          }
        }
        function main(): byte {
          return n::fn();
        }
      `);
    });

    test('lookup same namespace (nested)', () => {
      return expectValid(`
        namespace outer {
          namespace n {
            global t: byte = 34;
            function fn(): byte {
              return t;
            }
          }
        }
        function main(): byte {
          return outer::n::fn();
        }
      `);
    });

    test('lookup same namespace, separate namespace declarations', () => {
      return expectValid(`
        namespace n {
          function fn(): byte {
            return t;
          }
        }
        namespace n {
          global t: byte = 34;
        }
        function main(): byte {
          return n::fn();
        }
      `);
    });

    test('lookup shadowed global outside of namespace', () => {
      return expectValid(`
        function main(): byte {
          return foo::fn();
        }

        global i: byte = 44;

        namespace foo {
          global i: byte = 22;

          function fn(): byte {
            return global::i;
          }
        }
      `);
    });

    test('lookup using', () => {
      return expectValid(`
        using global::n;
        namespace n {
          global t: byte = 34;
          function fn(): byte {
            return t;
          }
        }
        function main(): byte {
          return fn();
        }
      `);
    });

    test('lookup nested using', () => {
      return expectValid(`
        using global::outer::n;
        namespace outer {
          namespace n {
            global t: byte = 34;
            function fn(): byte {
              return t;
            }
          }
        }
        function main(): byte {
          return fn();
        }
      `);
    });

    test('lookup nested using prefix', () => {
      return expectValid(`
        using global::outer;
        namespace outer {
          namespace n {
            global t: byte = 34;
            function fn(): byte {
              return t;
            }
          }
        }
        function main(): byte {
          return n::fn();
        }
      `);
    });

    test('lookup parent', () => {
      return expectValid(`
        global t: byte = 34;
        namespace n {
          function fn(): byte {
            return t;
          }
        }
        function main(): byte {
          return n::fn();
        }
      `);
    });

    test('lookup parent after namespace', () => {
      return expectValid(`
        global t: * byte = null;
        namespace n {
          global t: byte = 10;
          function fn(): byte {
            return t;
          }
        }
        function main(): byte {
          return n::fn();
        }
      `);
    });

    test('lookup parent after namespace', () => {
      return expectValid(`
        namespace kernel {
          namespace memory {
            type page = struct {
              virtual_address: byte;
              physical_address: byte;
            };

            type table = struct {
              pages: page[];
            };
          }
        }
      `);
    });

  });

  describe('Template instantiation', () => {
    test('simple instantiation', () => {
      return expectValid(`
        type vector<T> = T[];
        function reduce<T, C>(vec: vector<T>, fn: (T, C) => C, c: C): C {
          for(var i = 0; i < len vec; i = i + 1){
            c = fn(vec[i], c);
          }
          return c;
        }
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        function sum(v: vector<byte>): byte {
          return reduce<byte, byte>(v, add, 0);
        }
      `);
    });

    test('simple instantiation, nominal type', () => {
      return expectValid(`
        type vector<T> = T[];
        type int = byte;
        function reduce<T, C>(vec: vector<T>, fn: (T, C) => C, c: C): C {
          for(var i = 0; i < len vec; i = i + 1){
            c = fn(vec[i], c);
          }
          return c;
        }
        function add(a: int, b: int): int {
          return a + b;
        }
        function sum(v: vector<int>): int {
          return reduce<int, int>(v, add, 0);
        }
      `);
    });

    test('simple instantiation, in namespace, with confused instantiating type', () => {
      return expectValid(`
        namespace std {
          type vector<T> = T[];
          function reduce<T, C>(vec: vector<T>, fn: (T, C) => C, c: C): C {
            for(var i = 0; i < len vec; i = i + 1){
              c = fn(vec[i], c);
            }
            return c;
          }
          type int = void;
        }
        type int = byte;
        function add(a: int, b: int): int {
          return a + b;
        }
        function sum(v: std::vector<int>): int {
          return std::reduce<int, int>(v, add, 0);
        }
      `);
    });

    test('simple instantiation, in namespace, with confused template type', () => {
      return expectValid(`
        namespace std {
          type vector<T> = T[];
          function reduce<T, C>(vec: vector<T>, fn: (T, C) => C, c: C): C {
            for(var i = 0; i < len vec; i = i + 1){
              c = fn(vec[i], c);
            }
            return c;
          }
          type int = void;
        }
        type vector = byte;
        type int = byte;
        function add(a: int, b: int): int {
          return a + b;
        }
        function sum(v: std::vector<int>): int {
          return std::reduce<int, int>(v, add, 0);
        }
      `);
    });
  })

  test('void does not need return', () => {
    expectValid(`
      function main(): void {
        var i: byte = 0;
      }
    `);
  });

  test('recursive struct', () => {
    expectValid(`
      type List = struct {
        element: * byte;
        next: * List;
      };
    `);
  });

  describe('Typechecking errors', () => {
    test('nominal check', () => {
      expect(errors(`
        type int = byte;
        function main(): byte {
          var i: int = 0;
          return i;
        }
      `)).toEqual(['expected byte, actual int']);
    });

    test('arithmetic', () => {
      expect(errors(`
        type int = byte;
        function main(): void {
          var i: int = 0;
          var j: byte = 1;
          i + j;
        }
      `)).toEqual(['expected int, actual byte']);
    });

    test('struct wrong type', () => {
      expect(errors(`
        type Point = struct {
          x: byte;
          y: byte;
        };
        function main(): void {
          var p = Point { x=2, y="hi" };
        }`
      )).toContain('member y expected byte, actual byte[0x02]');
    });

    test('struct extra', () => {
      expect(errors(`
        type Point = struct {
          x: byte;
          y: byte;
        };
        function main(): void {
          var p = Point { x=2, y=3, z=4 };
        }`
      )).toContain('unknown member z');
    });

    test('no return', () => {
      expect(errors(`
        function main(): byte {
          var i: byte = 0;
        }
      `)).toEqual([`non-void function missing return`]);
    });

    test('no return - only if has return', () => {
      expect(errors(`
        function main(): byte {
          if(0){
            return 1;
          }
        }
      `)).toEqual([`non-void function missing return`]);
    });

    test('no type for array', () => {
      expect(errors(`
        function main(): byte {
          var bs = [];
          return 0;
        }
      `)).toContain(`expected contextual array type for empty array`);
    });

    test('no type for null', () => {
      expect(errors(`
        function main(): byte {
          var bs = null;
          return 0;
        }
      `)).toContain(`expected contextual pointer type for null`);
    });

    test('invalid break', () => {
      expect(errors(`
        function main(): byte {
          break;
        }
      `)).toContain(`break outside of for or while`);
    });

    // With slices, initializer can be smaller than cap (valid)
    // and initializer can be larger than cap (also valid, but truncates)
    // These tests are no longer applicable since byte[] is now a slice
    test('heap allocate array, initializer too short - now valid with slices', () => {
      return expect(errors(`
        function main(): byte {
          var ps: byte[] = new byte[3] = [1,2];
          return ps[0];
        }
      `)).toEqual([]);
    });

    test('heap allocate array, initializer too long - now valid with slices', () => {
      return expect(errors(`
        function main(): byte {
          var ps: byte[] = new byte[2] = [1,2,3];
          return ps[0];
        }
      `)).toEqual([]);
    });

    test('uninstantiated template type', () => {
      return expect(errors(`
        function t<T>(): void {
          return;
        }
        function main(): byte {
          var foo = t;
          return 0;
        }
      `)).toContain(`t not instantiated`);
    });

    test('instantiated template type', () => {
      return expect(errors(`
        function t<T>(): void {
          return;
        }
        function main(): byte {
          var foo = t<byte>;
          return 0;
        }
      `).length).toBe(0);
    });

    test('too deep', () => {
      expect(errors(`
      function t<T>(a: T): T {
        return *t(&a);
      }
      function main(): byte {
        return t(0);
      }
      `).join('\n')).toContain('too many instantiations');
    });
  });

  describe('Type inference', () => {
    test('infer var', () => {
      expectValid(`
        function main(): byte {
          var i = 0;
          return i;
        }
      `);
    });

    test('infer array', () => {
      expectValid(`
        function main(): byte {
          var bs = [ 0, 1 ];
          return bs[1];
        }
      `);
    });

    test('contextual int', () => {
      expectValid(`
        type int = byte;
        function main(): int {
          var i: int = 0;
          return i;
        }
      `)
    });
  });
});

describe('QLLC end-to-end', () => {
  // Load bare entrypoint for tests
  const entrypointFilename = path.resolve(__dirname, '..', '..', 'bare', 'entrypoint.qasm');
  const entrypointText = fs.readFileSync(entrypointFilename, 'utf-8');
  const entrypointAssemblyProgram = AssemblyProgram.parse(entrypointText, entrypointFilename);

  // Load allocator files for tests that use new/delete
  const sharedAllocFilename = path.resolve(__dirname, '..', '..', 'shared', 'alloc.qll');
  const bareAllocFilename = path.resolve(__dirname, '..', '..', 'bare', 'alloc.qll');
  const sharedAllocText = fs.readFileSync(sharedAllocFilename, 'utf-8');
  const bareAllocText = fs.readFileSync(bareAllocFilename, 'utf-8');
  const allocatorProgram = LowLevelProgram.concat([
    LowLevelProgram.parse(sharedAllocText, sharedAllocFilename),
    LowLevelProgram.parse(bareAllocText, bareAllocFilename),
  ]);

  async function run(programText: string, includeAllocator: boolean = false, cycles: number = 500): Promise<VMResult | string> {
    try {
      let programs = [LowLevelProgram.parse(programText)];
      if (includeAllocator) {
        programs = [allocatorProgram, ...programs];
      }
      const program = LowLevelProgram.concat(programs);
      const errors = program.typecheck().errors;
      if (errors.length) {
        throw new Error(errors.join('\n'));
      }

      // Combine entrypoint (first) with compiled program
      const assemblyProgram = AssemblyProgram.concat([entrypointAssemblyProgram, program.compile()]);

      const [messages, binaryProgram] = assemblyProgram.assemble();
      if (!binaryProgram) {
        throw new Error(messages.toString() || 'internal error');
      }

      const memory = binaryProgram.encode();
      const vm = new VM({
        debug: true,
        cycles: cycles,
      });
      return await vm.run(memory);
    }
    catch (e: any) {
      if (e.location) {
        return `${e.location.filename}(${e.location.start.line}): ${e.message}`;
      }
      return `${e}`;
    }
  }

  function expectRunToBe(value: number, text: string, includeAllocator: boolean = false, cycles?: number) {
    return expect(run(text, includeAllocator, cycles).then((n) => typeof n === 'string' ? n : Immediate.toString(n))).resolves.toBe(Immediate.toString(value));
  }

  function expectCompileError(errorSubstring: string, text: string) {
    return expect(run(text, false).then((n) => {
      if (typeof n === 'string') {
        return n;
      }
      throw new Error('expected compile error, but program ran successfully');
    })).resolves.toContain(errorSubstring);
  }

  function expectExpressionToBe(expr: string, value: number) {
    return expectRunToBe(value, `
      function main(): byte {
        return <byte>(${expr});
      }
    `);
  }

  test('constant', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return 42;
      }
    `);
  });

  test('!', () => {
    return expectRunToBe(0, `
      function main(): byte {
        return <byte>!42;
      }
    `);
  });

  test('!!', () => {
    return expectRunToBe(1, `
      function main(): byte {
        return <byte>!!42;
      }
    `);
  });

  test('&&', () => {
    const runs: [string, number][] = [
      ['1 && 2', 2],
      ['1 && 0', 0],
      ['1 && <byte>false', 0],
      ['21 && <unsafe byte><* byte>null', 0],
    ];
    return Promise.all(runs.map(([expr, value], i) => {
      return expectExpressionToBe(expr, value);
    }));
  });

  test('||', () => {
    const runs: [string, number][] = [
      ['17 || 2', 17],
      ['0 || 2', 2],
      ['<byte>false || 12', 12],
      ['13 || <byte>false', 13],
    ];
    return Promise.all(runs.map(([expr, value], i) => {
      return expectExpressionToBe(expr, value);
    }));
  });

  test('local', () => {
    return expectRunToBe(33, `
      function main(): byte {
        var answer: byte = 33;
        return answer;
      }
    `);
  });

  test('locals', () => {
    return expectRunToBe(22, `
      function main(): byte {
        var answer: byte = 22;
        var question: byte = 100;
        var another: byte = 10;
        return answer;
      }
    `);
  });

  test('locals - other order', () => {
    return expectRunToBe(11, `
      function main(): byte {
        var question: byte = 100;
        var answer: byte = 11;
        var another: byte = 10;
        return answer;
      }
    `);
  });

  test('locals - another other order', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var question: byte = 100;
        var answer: byte = 11;
        var another: byte = 10;
        return another;
      }
    `);
  });

  test('locals - non-integral', () => {
    return expectRunToBe(66, `
      type Point = struct {
        x: byte;
        y: byte;
      };
      function main(): byte {
        var p: Point;
        p.x = 66;
        p.y = 100;
        return p.x;
      }
    `);
  });

  test('locals - non-integral', () => {
    return expectRunToBe(77, `
      type Point = struct {
        x: byte;
        y: byte;
      };
      function main(): byte {
        var p: Point;
        p.x = 100;
        p.y = 77;
        return p.y;
      }
    `);
  });

  test('locals - non-integral assignment', () => {
    return expectRunToBe(25, `
      type Point = struct {
        x: byte;
        y: byte;
      };
      function main(): byte {
        var p: Point;
        p.x = 25;
        p.y = 100;
        var q: Point = p;
        return p.x;
      }
    `);
  });

  test('locals - non-integral assignment', () => {
    return expectRunToBe(55, `
      type Point = struct {
        x: byte;
        y: byte;
      };
      function main(): byte {
        var p: Point;
        p.x = 100;
        p.y = 55;
        var q: Point = p;
        return p.y;
      }
    `);
  });

  test('call', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return fn();
      }

      function fn(): byte {
        return 42;
      }
    `);
  });

  test('call - arg', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return fn(42);
      }

      function fn(a: byte): byte {
        return a;
      }
    `);
  });

  test('call - arg with local', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return fn(42);
      }

      function fn(a: byte): byte {
        var b = a;
        return b;
      }
    `);
  });

  test('call - args', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return fn(42, 100, 200);
      }

      function fn(a: byte, b: byte, c: byte): byte {
        return a;
      }
    `);
  });

  test('call - args - other order', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return fn(100, 42, 200);
      }

      function fn(a: byte, b: byte, c: byte): byte {
        return b;
      }
    `);
  });

  test('call - args - yet another order', () => {
    return expectRunToBe(42, `
      function main(): byte {
        return fn(100, 200, 42);
      }

      function fn(a: byte, b: byte, c: byte): byte {
        return c;
      }
    `);
  });

  test('call - mixed args', () => {
    return expectRunToBe(103, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 103;
        p.y = 104;
        var i = 10;
        return fn(&i, p);
      }

      function fn(a: * byte, p: Point): byte {
        return p.x;
      }
    `);
  });

  test('call - non-integral arg', () => {
    return expectRunToBe(101, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 101;
        p.y = 102;
        return fn(p);
      }

      function fn(p: Point): byte {
        return p.x;
      }
    `);
  });

  test('call - non-integral arg - other order', () => {
    return expectRunToBe(102, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 101;
        p.y = 102;
        return fn(p);
      }

      function fn(p: Point): byte {
        return p.y;
      }
    `);
  });

  test('call - non-integral args', () => {
    return expectRunToBe(101, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 101;
        p.y = 102;
        var q: Point;
        q.x = 103;
        q.y = 104;
        return fn(p, q);
      }

      function fn(p: Point, q: Point): byte {
        return p.x;
      }
    `);
  });

  test('call - non-integral args', () => {
    return expectRunToBe(102, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 101;
        p.y = 102;
        var q: Point;
        q.x = 103;
        q.y = 104;
        return fn(p, q);
      }

      function fn(p: Point, q: Point): byte {
        return p.y;
      }
    `);
  });

  test('call - non-integral args', () => {
    return expectRunToBe(103, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 101;
        p.y = 102;
        var q: Point;
        q.x = 103;
        q.y = 104;
        return fn(p, q);
      }

      function fn(p: Point, q: Point): byte {
        return q.x;
      }
    `);
  });

  test('call - non-integral args', () => {
    return expectRunToBe(104, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point;
        p.x = 101;
        p.y = 102;
        var q: Point;
        q.x = 103;
        q.y = 104;
        return fn(p, q);
      }

      function fn(p: Point, q: Point): byte {
        return q.y;
      }
    `);
  });

  test('address of integral', () => {
    return expectRunToBe(66, `
      function main(): byte {
        var i: byte = 33;
        var p: * byte = &i;
        (*p) = 66;
        return i;
      }
    `);
  });

  test('address of integrals', () => {
    return expectRunToBe(44, `
      function main(): byte {
        var i: byte = 55;
        var j: byte = 22;
        var p: * byte = &i;
        (*p) = 44;
        return i;
      }
    `);
  });

  test('address of integrals', () => {
    return expectRunToBe(77, `
      function main(): byte {
        var i: byte = 55;
        var j: byte = 22;
        var p: * byte = &j;
        (*p) = 77;
        return j;
      }
    `);
  });

  test('function pointer', () => {
    return expectRunToBe(10, `
      type bytefn = () => byte;

      function one(): byte {
        return 10;
      }

      function two(): byte {
        return 20;
      }

      function main(): byte {
        var fn: bytefn = one;
        return fn();
      }
    `);
  });

  test('function pointer', () => {
    return expectRunToBe(20, `
      type bytefn = () => byte;

      function one(): byte {
        return 10;
      }

      function two(): byte {
        return 20;
      }

      function main(): byte {
        var fn: bytefn = two;
        return fn();
      }
    `);
  });

  test('string literal', () => {
    return expectRunToBe(72, `
      function main(): byte {
        var s = "Hello!";
        return s[0];
      }
    `);
  });

  test('array literal', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var s: byte[] = [
          20 + 22,
          10
        ];
        return s[1];
      }
    `);
  });

  test('struct literal', () => {
    return expectRunToBe(20, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point = Point {
          x = 10,
          y = 20,
        };
        return p.y;
      }
    `);
  });

  test('struct literal out of order', () => {
    return expectRunToBe(20, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point = Point {
          y = 20,
          x = 10,
        };
        return p.y;
      }
    `);
  });

  test('struct literal skip', () => {
    return expectRunToBe(0, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point = Point {
          y = 20,
        };
        return p.x;
      }
    `);
  });

  test('struct literal skip (other)', () => {
    return expectRunToBe(20, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point = Point {
          y = 20,
        };
        return p.y;
      }
    `);
  });

  test('inferred struct literal', () => {
    return expectRunToBe(20, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p = Point {
          x = 10,
          y = 20,
        };
        return p.y;
      }
    `);
  });

  test('struct literal array', () => {
    return expectRunToBe(50, `
      type Point = struct {
        x: byte;
        y: byte;
      };

      function main(): byte {
        var p: Point[] = [
          Point {
            x = 10,
            y = 20,
          },
          Point {
            x = 30,
            y = 40,
          },
        ];
        return p[0].x + p[1].y;
      }
    `);
  });

  test('global literal', () => {
    return expectRunToBe(100, `
      global g: byte = 100;
      function main(): byte {
        return g;
      }
    `);
  });

  test('global string literal', () => {
    return expectRunToBe(72, `
      global g: byte[] = "Hello!";
      function main(): byte {
        return g[0];
      }
    `);
  });

  test('global string literal fixed-size array', () => {
    return expectRunToBe(72, `
      global g: byte[6] = "Hello!";
      function main(): byte {
        return g[0];
      }
    `);
  });

  test('global struct literal', () => {
    return expectRunToBe(20, `
      type Point = struct {
        x: byte;
        y: byte;
      };
      global g: Point = Point {
        x = 10,
        y = 20,
      };
      function main(): byte {
        return g.y;
      }
    `);
  });

  test('simple namespace', () => {
    return expectRunToBe(22, `
      function main(): byte {
        return foo::fn();
      }

      namespace foo {
        function fn(): byte {
          return 22;
        }
      }
    `);
  });

  test('access global in namespace', () => {
    return expectRunToBe(33, `
      function main(): byte {
        return foo::fn();
      }

      namespace foo {
        global i: byte = 33;
        function fn(): byte {
          return i;
        }
      }
    `);
  });

  test('access global outside of namespace', () => {
    return expectRunToBe(55, `
      function main(): byte {
        return foo::fn();
      }

      global i: byte = 55;

      namespace foo {
        function fn(): byte {
          return i;
        }
      }
    `);
  });

  test('arithmetic', () => {
    const runs: [string, number][] = [
      ['-7', -7],
      ['0 + 1', 1],
      ['-20 + 40', 20],
      ['0xffffffff + 1', 0],
    ];
    return Promise.all(runs.map(([expr, value], i) => {
      return expectExpressionToBe(expr, value);
    }));
  });

  test('comparison', () => {
    const runs: [string, number][] = [
      ['1 < 0', 0],
      [`1 < 1`, 0],
      [`1 < 2`, 1],
      [`1 <= 0`, 0],
      [`1 <= 1`, 1],
      [`1 <= 2`, 1],
      [`1 > 0`, 1],
      [`1 > 1`, 0],
      [`1 > 2`, 0],
      [`1 >= 0`, 1],
      [`1 >= 1`, 1],
      [`1 >= 2`, 0],
    ];
    return Promise.all(runs.map(([expr, value], i) => {
      return expectExpressionToBe(expr, value);
    }));
  });

  test('if', () => {
    return expectRunToBe(3, `
      function main(): byte {
        var i = 3;
        var j = 5;
        if(i < j){
          return i;
        }
        return j;
      }
    `);
  });

  test('if/else -- if', () => {
    return expectRunToBe(3, `
      function main(): byte {
        var i = 3;
        var j = 5;
        if(i < j){
          return i;
        }
        else {
          return j;
        }
      }
    `);
  });

  test('if/else -- else', () => {
    return expectRunToBe(5, `
      function main(): byte {
        var i = 3;
        var j = 5;
        if(i > j){
          return i;
        }
        else {
          return j;
        }
      }
    `);
  });

  test('if/else if/else -- if', () => {
    return expectRunToBe(3, `
      function main(): byte {
        var i = 3;
        var j = 5;
        if(i < j){
          return i;
        }
        else if(2 * i > j){
          return j;
        }
        else {
          return 42;
        }
      }
    `);
  });

  test('if/else if/else -- else if', () => {
    return expectRunToBe(5, `
      function main(): byte {
        var i = 3;
        var j = 5;
        if(i > j){
          return i;
        }
        else if(2 * i > j){
          return j;
        }
        else {
          return 42;
        }
      }
    `);
  });

  test('if/else if/else -- else', () => {
    return expectRunToBe(42, `
      function main(): byte {
        var i = 3;
        var j = 7;
        if(i > j){
          return i;
        }
        else if(2 * i > j){
          return j;
        }
        else {
          return 42;
        }
      }
    `);
  });

  test('stack allocate array (capacity)', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var ar: byte[10];
        return cap ar;
      }
    `);
  });

  test('stack allocate array (len)', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var ar: byte[10];
        return len ar;
      }
    `);
  });

  // Fixed-size arrays no longer have a mutable length field.
  // Assigning to `len arr` for a fixed-size array is a compile error.
  test('stack allocate array, len is not assignable', () => {
    return expectCompileError('expected len(ar) to be assignable', `
      function main(): byte {
        var ar: byte[10];
        len ar = 5;
        return len ar;
      }
    `);
  });

  test('heap allocate', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var b: * byte = new byte;
        *b = 10;
        return *b;
      }
    `, true);
  });

  test('heap allocate too much', () => {
    // Request more than HEAP_SIZE (0x10000 = 64KB) to test allocation failure.
    return expectRunToBe(0, `
      function main(): byte {
        var b = new byte [0x20000];
        return <unsafe byte>b;
      }
    `, true);
  });

  test('heap allocate (infer)', () => {
    return expectRunToBe(20, `
      function main(): byte {
        var b = new byte;
        *b = 20;
        return *b;
      }
    `, true);
  });

  test('heap allocate (address)', () => {
    return expectRunToBe(0x8003, `
      function main(): byte {
        var b: * byte = new byte = 10;
        return <unsafe byte>b;
      }
    `, true);
  });

  test('heap allocate delete allocate', () => {
    return expectRunToBe(22, `
      function main(): byte {
        var b: * byte = new byte = 10;
        delete b;
        b = new byte = 22;
        return *b;
      }
    `, true, 2000);
  });

  test('heap allocate delete allocate (address)', () => {
    return expectRunToBe(0x8003, `
      function main(): byte {
        var b: * byte = new byte = 10;
        delete b;
        b = new byte = 20;
        return <unsafe byte>b;
      }
    `, true, 2000);
  });

  test('heap allocate multiple times (address)', () => {
    return expectRunToBe(0x800b, `
      function main(): byte {
        var a: * byte = new byte = 10;
        var b: * byte = new byte = 11;
        var c: * byte = new byte = 12;
        return <unsafe byte>c;
      }
    `, true, 5000);
  });

  test('heap allocate with initializer', () => {
    return expectRunToBe(20, `
      function main(): byte {
        var b: * byte = new byte = 20;
        return *b;
      }
    `, true);
  });

  test('heap allocate struct with initializer', () => {
    return expectRunToBe(20, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: * Point = new Point = Point { x = 10, y = 20 };
        return (*p).y;
      }
    `, true);
  });

  test('heap allocate struct', () => {
    return expectRunToBe(13, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: * Point = new Point;
        p->x = 13;
        return p->x;
      }
    `, true);
  });

  test('heap allocate struct multiple times (address)', () => {
    return expectRunToBe(0x8008, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p: * Point = new Point;
        var q: * Point = new Point;
        return <unsafe byte>q;
      }
    `, true, 2000);
  });

  test('heap allocate array', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var b: byte[] = new byte [8];
        b[5] = 10;
        return b[5];
      }
    `, true);
  });

  test('heap allocate array (len)', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var b: byte[] = new byte [10];
        b[5] = 10;
        return len b;
      }
    `, true);
  });

  test('heap allocate array (capacity)', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var b: byte[] = new byte [10];
        b[5] = 10;
        return cap b;
      }
    `, true);
  });

  test('heap allocate array (infer)', () => {
    return expectRunToBe(13, `
      function main(): byte {
        var b: byte[] = new byte [10];
        b[3] = 13;
        return b[3];
      }
    `, true);
  });

  test('heap allocate array with ellipsis', () => {
    return expectRunToBe(17, `
      function main(): byte {
        var b: byte[] = new byte [5] ... 17;
        return b[3];
      }
    `, true);
  });

  test('heap allocate array of structs', () => {
    return expectRunToBe(15, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[10];
        ps[3].x = 15;
        return ps[3].x;
      }
    `, true, 2000);
  });

  test('heap allocate array of structs (len)', () => {
    return expectRunToBe(13, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[13];
        ps[3].x = 4;
        return len ps;
      }
    `, true, 2000);
  });

  test('heap allocate array of structs (capacity)', () => {
    return expectRunToBe(13, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[13];
        ps[3].x = 4;
        return cap ps;
      }
    `, true, 2000);
  });

  test('heap allocate array of structs with ellipsis', () => {
    return expectRunToBe(55, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[10] ... Point {
          x = 55,
          y = 66,
        };
        return ps[3].x;
      }
    `, true, 2000);
  });

  test('heap allocate array of structs with initializer', () => {
    return expectRunToBe(4, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[] = [
          Point {
            x = 1,
            y = 2,
          },
          Point {
            x = 3,
            y = 4,
          },
        ];
        return ps[1].y;
      }
    `, true);
  });

  test('heap allocate array of structs with initializer (len)', () => {
    return expectRunToBe(2, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[] = [
          Point {
            x = 1,
            y = 2,
          },
          Point {
            x = 3,
            y = 4,
          },
        ];
        return len ps;
      }
    `, true);
  });

  test('heap allocate array of structs with ellipsis many times', () => {
    return expectRunToBe(55, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps: Point[] = new Point[10] ... Point {
          x = 55,
          y = 66,
        };
        ps = new Point[10] ... Point {
          x = 55,
          y = 66,
        };
        ps = new Point[10] ... Point {
          x = 55,
          y = 66,
        };
        ps = new Point[10] ... Point {
          x = 55,
          y = 66,
        };
        return ps[3].x;
      }
    `, true, 3000);
  });

  test('null', () => {
    return expectRunToBe(0, `
      function main(): byte {
        var b: * byte = null;
        var bb: ** byte = null;
        return <unsafe byte>b + <unsafe byte>bb;
      }
    `);
  });

  test('deref null', () => {
    return expectRunToBe(Compiler.NULL_ERROR, `
      function main(): byte {
        var b: * byte = null;
        *b = 23;
        return 42;
      }
    `);
  });

  test('sizeof byte', () => {
    return expectRunToBe(1, `
      function main(): byte {
        return sizeof byte;
      }
    `);
  });

  test('sizeof byte[]', () => {
    // SliceType has size 3: [pointer][length][capacity]
    return expectRunToBe(3, `
      function main(): byte {
        return sizeof byte[];
      }
    `);
  });

  test('sizeof Point', () => {
    return expectRunToBe(2, `
      type int = byte;
      type Point = struct { x: int; y: int; };
      function main(): byte {
        return sizeof Point;
      }
    `);
  });

  test('sizeof Point3D', () => {
    return expectRunToBe(3, `
      type int = byte;
      type Point3D = struct { x: int; y: int; z: int; };
      function main(): byte {
        return sizeof Point3D;
      }
    `);
  });

  test('sizeof nested struct', () => {
    return expectRunToBe(6, `
      type int = byte;
      type Point3D = struct { x: int; y: int; z: int; };
      type Pair = struct { left: Point3D; right: Point3D; };
      function main(): byte {
        return sizeof Pair;
      }
    `);
  });

  test('for', () => {
    return expectRunToBe(6, `
      function main(): byte {
        var j = 0;
        for(var i = 0; i < 4; i = i + 1){
          j = j + i;
        }
        return j;
      }
    `);
  });

  test('for break', () => {
    return expectRunToBe(3, `
      function main(): byte {
        var j = 0;
        for(var i = 0; i < 4; i = i + 1){
          j = j + i;
          if(j > 1){
            break;
          }
        }
        return j;
      }
    `);
  });

  test('while', () => {
    return expectRunToBe(4, `
      function main(): byte {
        var j = 0;
        while(j < 4){
          j = j + 1;
        }
        return j;
      }
    `);
  });

  test('while break', () => {
    return expectRunToBe(6, `
      function main(): byte {
        var j = 0;
        while(j < 10){
          j = j + 1;
          if(j > 5){
            break;
          }
        }
        return j;
      }
    `);
  });

  test('sized array assignment', () => {
    return expectRunToBe(6, `
      function main(): byte {
        var b: byte[3] = [1,2,3];
        b = [4,5,6];
        return b[2];
      }
    `);
  });

  test('return integral', () => {
    return expectRunToBe(10, `
      function main(): byte {
        return f(5);
      }
      function f(n: byte): byte {
        return n * 2;
      }
    `);
  });

  test('return struct', () => {
    return expectRunToBe(4, `
      type Point = struct {
        x: byte;
        y: byte;
      };
      function main(): byte {
        return (add(Point { x=1, y=2 }, Point { x=3, y=4 })).x;
      }
      function add(p1: Point, p2: Point): Point {
        return Point { x = p1.x + p2.x, y = p1.y + p2.y };
      }
    `);
  });

  // Slice expression tests
  test('slice expression from stack array', () => {
    // arr[1:4] creates a slice with elements at indices 1, 2, 3 -> length 3
    return expectRunToBe(3, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        arr[3] = 40;
        arr[4] = 50;
        var s: byte[] = arr[1:4];
        return len s;
      }
    `);
  });

  test('slice expression access element', () => {
    return expectRunToBe(30, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        arr[3] = 40;
        arr[4] = 50;
        var s: byte[] = arr[1:4];
        return s[1];
      }
    `);
  });

  test('slice expression default lo', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        var s: byte[] = arr[:2];
        return s[0];
      }
    `);
  });

  test('slice expression default hi', () => {
    return expectRunToBe(50, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        arr[3] = 40;
        arr[4] = 50;
        var s: byte[] = arr[2:];
        return s[2];
      }
    `);
  });

  test('slice expression both defaults', () => {
    return expectRunToBe(5, `
      function main(): byte {
        var arr: byte[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        arr[3] = 40;
        arr[4] = 50;
        var s: byte[] = arr[:];
        return len s;
      }
    `);
  });

  test('slice expression capacity', () => {
    return expectRunToBe(4, `
      function main(): byte {
        var arr: byte[5];
        var s: byte[] = arr[1:3];
        return cap s;
      }
    `);
  });

  test('slice expression from heap slice', () => {
    // s[1:4] creates a slice with elements at indices 1, 2, 3 -> length 3
    return expectRunToBe(3, `
      function main(): byte {
        var s: byte[] = new byte[5];
        s[0] = 10;
        s[1] = 20;
        s[2] = 30;
        s[3] = 40;
        s[4] = 50;
        var s2: byte[] = s[1:4];
        return len s2;
      }
    `, true, 2000);
  });

  test('reslice access element', () => {
    return expectRunToBe(40, `
      function main(): byte {
        var s: byte[] = new byte[5];
        s[0] = 10;
        s[1] = 20;
        s[2] = 30;
        s[3] = 40;
        s[4] = 50;
        var s2: byte[] = s[1:];
        return s2[2];
      }
    `, true, 2000);
  });

  // Slice function argument tests
  test('pass slice to function', () => {
    return expectRunToBe(3, `
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

  test('pass string literal to slice parameter', () => {
    return expectRunToBe(5, `
      function getLen(s: string): byte {
        return len s;
      }
      function main(): byte {
        return getLen("hello");
      }
    `);
  });

  test('pass array to slice parameter', () => {
    return expectRunToBe(5, `
      function getLen(s: byte[]): byte {
        return len s;
      }
      function main(): byte {
        var arr: byte[5];
        arr[0] = 1;
        arr[1] = 2;
        arr[2] = 3;
        arr[3] = 4;
        arr[4] = 5;
        return getLen(arr);
      }
    `);
  });

  test('access array element via slice parameter', () => {
    return expectRunToBe(30, `
      function getSecond(s: byte[]): byte {
        return s[1];
      }
      function main(): byte {
        var arr: byte[3];
        arr[0] = 10;
        arr[1] = 30;
        arr[2] = 50;
        return getSecond(arr);
      }
    `);
  });

  test('multiple slice parameters', () => {
    return expectRunToBe(8, `
      function sumLens(a: byte[], b: byte[]): byte {
        return len a + len b;
      }
      function main(): byte {
        var arr1: byte[3];
        var arr2: byte[5];
        return sumLens(arr1, arr2);
      }
    `);
  });

  test('mixed integral and slice parameters', () => {
    return expectRunToBe(13, `
      function compute(x: byte, s: byte[], y: byte): byte {
        return x + len s + y;
      }
      function main(): byte {
        var arr: byte[3];
        return compute(5, arr, 5);
      }
    `);
  });

  test('return slice from function', () => {
    return expectRunToBe(20, `
      function makeSlice(): byte[] {
        var arr: byte[3];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        return arr[:];
      }
      function main(): byte {
        var s: byte[] = makeSlice();
        return s[1];
      }
    `);
  });

  test('nested calls with slice conversion', () => {
    return expectRunToBe(5, `
      function inner(s: byte[]): byte {
        return len s;
      }
      function outer(s: byte[]): byte {
        return inner(s);
      }
      function main(): byte {
        return outer("hello");
      }
    `);
  });

  // Test float operations by converting result to int
  function expectFloatResultToBe(expr: string, intValue: number) {
    return expectRunToBe(intValue, `
      function main(): byte {
        return <byte>(${expr});
      }
    `);
  }

  function expectFloatComparisonToBe(expr: string, value: boolean) {
    return expectRunToBe(value ? 1 : 0, `
      function main(): byte {
        return <byte>(${expr});
      }
    `);
  }

  describe('float', () => {
    test('float literal converted to int', () => {
      return expectFloatResultToBe('3.14f', 3);
    });

    test('float negative literal converted to int', () => {
      // -2.5 truncated to int is -2, which as unsigned byte is 0xFFFFFFFE
      return expectFloatResultToBe('-2.5f', -2);
    });

    test('float exponent literal converted to int', () => {
      return expectFloatResultToBe('1.5e2f', 150);
    });

    test('float arithmetic: add', () => {
      // 1.5 + 2.5 = 4.0, converts to 4
      return expectFloatResultToBe('1.5f + 2.5f', 4);
    });

    test('float arithmetic: sub', () => {
      // 5.0 - 2.0 = 3.0, converts to 3
      return expectFloatResultToBe('5.0f - 2.0f', 3);
    });

    test('float arithmetic: mul', () => {
      // 3.0 * 4.0 = 12.0, converts to 12
      return expectFloatResultToBe('3.0f * 4.0f', 12);
    });

    test('float arithmetic: div', () => {
      // 10.0 / 4.0 = 2.5, converts to 2
      return expectFloatResultToBe('10.0f / 4.0f', 2);
    });

    test('float unary negation', () => {
      // -(5.0) = -5.0, converts to -5
      return expectFloatResultToBe('-(5.0f)', -5);
    });

    test('float comparison: eq true', () => {
      return expectFloatComparisonToBe('3.0f == 3.0f', true);
    });

    test('float comparison: eq false', () => {
      return expectFloatComparisonToBe('3.0f == 4.0f', false);
    });

    test('float comparison: neq true', () => {
      return expectFloatComparisonToBe('3.0f != 4.0f', true);
    });

    test('float comparison: neq false', () => {
      return expectFloatComparisonToBe('3.0f != 3.0f', false);
    });

    test('float comparison: lt true', () => {
      return expectFloatComparisonToBe('2.0f < 3.0f', true);
    });

    test('float comparison: lt false', () => {
      return expectFloatComparisonToBe('3.0f < 2.0f', false);
    });

    test('float comparison: gt true', () => {
      return expectFloatComparisonToBe('3.0f > 2.0f', true);
    });

    test('float comparison: gt false', () => {
      return expectFloatComparisonToBe('2.0f > 3.0f', false);
    });

    test('float comparison: lte true (less)', () => {
      return expectFloatComparisonToBe('2.0f <= 3.0f', true);
    });

    test('float comparison: lte true (equal)', () => {
      return expectFloatComparisonToBe('3.0f <= 3.0f', true);
    });

    test('float comparison: lte false', () => {
      return expectFloatComparisonToBe('4.0f <= 3.0f', false);
    });

    test('float comparison: gte true (greater)', () => {
      return expectFloatComparisonToBe('4.0f >= 3.0f', true);
    });

    test('float comparison: gte true (equal)', () => {
      return expectFloatComparisonToBe('3.0f >= 3.0f', true);
    });

    test('float comparison: gte false', () => {
      return expectFloatComparisonToBe('2.0f >= 3.0f', false);
    });

    test('float conversion: int to float', () => {
      // 42 -> 42.0f -> 42
      return expectFloatResultToBe('<float>42', 42);
    });

    test('float conversion: float to int', () => {
      return expectRunToBe(42, `
        function main(): byte {
          return <byte>42.5f;
        }
      `);
    });

    test('float variable', () => {
      return expectRunToBe(3, `
        function main(): byte {
          var f: float = 2.5f;
          f = f + 1.0f;
          return <byte>f;
        }
      `);
    });

    test('float in struct', () => {
      return expectRunToBe(3, `
        type Point = struct { f: float; };
        function main(): byte {
          var p: Point = Point { f = 3.14f };
          return <byte>p.f;
        }
      `);
    });

    test('float complex expression', () => {
      // (1.0 + 2.0) * 3.0 - 1.0 = 8.0 -> 8
      return expectFloatResultToBe('(1.0f + 2.0f) * 3.0f - 1.0f', 8);
    });
  });
});

describe('Display e2e', () => {
  const entrypointFile = path.resolve(__dirname, '..', '..', 'bare', 'entrypoint.qasm');
  const graphicsFile = path.resolve(__dirname, '..', '..', 'shared', 'graphics.qll');
  const displayFile = path.resolve(__dirname, '..', '..', 'bare', 'display.qll');
  const waitFile = path.resolve(__dirname, '..', '..', 'bare', 'wait.qll');

  test('display flip writes correct pixels', async () => {
    const tempFile = path.join(os.tmpdir(), `display-test-${Date.now()}.ppm`);

    try {
      // Load libraries
      const entrypoint = AssemblyProgram.parse(fs.readFileSync(entrypointFile, 'utf-8'), entrypointFile);
      const graphicsProgram = LowLevelProgram.parse(fs.readFileSync(graphicsFile, 'utf-8'), graphicsFile);
      const displayProgram = LowLevelProgram.parse(fs.readFileSync(displayFile, 'utf-8'), displayFile);
      const waitProgram = LowLevelProgram.parse(fs.readFileSync(waitFile, 'utf-8'), waitFile);

      // Minimal test program: set 3 pixels and flip
      const testProgram = LowLevelProgram.parse(`
        .constant global DISPLAY_BASE: byte = 0x300;  // Only peripheral
        .constant global FB_ADDR: byte = 0x10000;

        function main(): byte {
          var fb = display::init(DISPLAY_BASE, <unsafe *byte>FB_ADDR);
          graphics::set_pixel(&fb, 0, 0, graphics::color::RED);
          graphics::set_pixel(&fb, 1, 0, graphics::color::GREEN);
          graphics::set_pixel(&fb, 2, 0, graphics::color::BLUE);
          display::flip(DISPLAY_BASE);
          return 0;
        }
      `);

      const program = LowLevelProgram.concat([graphicsProgram, displayProgram, waitProgram, testProgram]);
      const errors = program.typecheck().errors;
      if (errors.length) {
        throw new Error(errors.join('\n'));
      }

      const assembled = AssemblyProgram.concat([entrypoint, program.compile()]);
      const [messages, binary] = assembled.assemble();
      if (!binary) {
        throw new Error(messages.toString());
      }

      // Run with display peripheral
      const renderer = createFileRenderer(tempFile);
      const display = new DisplayPeripheral(4, 4, renderer);
      const vm = new VM({ peripherals: [display], cycles: 50000 });
      await vm.run(binary.encode());

      // Verify PPM output
      const ppm = fs.readFileSync(tempFile);
      const headerEnd = ppm.indexOf(0x0A, ppm.indexOf(0x0A, 3) + 1) + 1;
      const pixels = ppm.slice(headerEnd);

      // Check first 3 pixels (RGB format, 3 bytes each)
      // RED: R=255, G=0, B=0
      expect(pixels[0]).toBe(0xFF);
      expect(pixels[1]).toBe(0x00);
      expect(pixels[2]).toBe(0x00);
      // GREEN: R=0, G=255, B=0
      expect(pixels[3]).toBe(0x00);
      expect(pixels[4]).toBe(0xFF);
      expect(pixels[5]).toBe(0x00);
      // BLUE: R=0, G=0, B=255
      expect(pixels[6]).toBe(0x00);
      expect(pixels[7]).toBe(0x00);
      expect(pixels[8]).toBe(0xFF);
    } finally {
      fs.rmSync(tempFile, { force: true });
    }
  });
});
