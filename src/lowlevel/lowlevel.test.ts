import fs from 'fs';
import path from 'path';

import { LowLevelProgram } from './lowlevel';
import { Compiler } from './compiler';
import { parse as _parse } from './parser';
import { VM, VMResult } from '../vm/vm';
import { Immediate } from '../lib/base-types';
import { AssemblyProgram } from '../assembly/assembly';

const parse = LowLevelProgram.parse;

describe('QLLC parsing', () => {
  function parseError(programText: string){
    return () => {
      parse(programText);
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
  });

  describe('Comments and whitespace', () => {
    test('empty file', () => {
      expect(parse('').declarations.length).toBe(0);
    });
    test('almost empty file', () => {
      expect(parse('  \n  ').declarations.length).toBe(0);
    });
    test('comment only', () => {
      expect(parse('// Hi!\n').declarations.length).toBe(0);
    });
    test('comment only no newline', () => {
      expect(parse('// Hi!').declarations.length).toBe(0);
    });
    test('simple comments', () => {
      expect(parse(`
        // Hi!
        type int = byte; // Yeah!
      `).declarations.length).toBe(1);
    });

    test('more simple comments', () => {
      expect(parse(`
        // Hi!

        // And more.
        function f(): void {
          return 0;
        }
      `).declarations.length).toBe(1);
    });

    test('tagged types', () => {
      expect(parse(`
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
      expect(parse(`
        function foo<T>(t: T): void {}
      `).declarations.length).toBe(1);
    });
  });
});

describe('QLLC typechecking', () => {
  function expectValid(programText: string){
    const program: LowLevelProgram = parse(programText);
    const messages = program.typecheck();
    if(messages.errors.length){
      throw new Error(messages.toString());
    }
    expect(messages.errors.length).toBe(0);
  }

  function errors(programText: string): string[] {
    const program: LowLevelProgram = parse(programText);
    try {
      return program.typecheck().errors.map((error) => error.text);
    }
    catch(e){
      if(e.name === 'SyntaxError'){
        return [e.message];
      }
      throw e;
    }
  }

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

    test('heap allocate array, initializer too short', () => {
      return expect(errors(`
        function main(): byte {
          var ps = new byte[3] = [1,2];
          return ps[0];
        }
      `)).toContain(`new array initializer expected byte[0x03], actual byte[0x02]`);
    });

    test('heap allocate array, initializer too long', () => {
      return expect(errors(`
        function main(): byte {
          var ps = new byte[2] = [1,2,3];
          return ps[0];
        }
      `)).toContain(`new array initializer expected byte[0x02], actual byte[0x03]`);
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
  const systemFilename = path.resolve(__dirname, '..', '..', 'lib', 'bin', 'system.qasm');
  const systemText = fs.readFileSync(systemFilename, 'utf-8');
  const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

  async function run(programText: string, includeSystem: boolean, cycles: number = 500): Promise<VMResult | string> {
    try {
      const program: LowLevelProgram = parse(programText);
      const errors = program.typecheck().errors;
      if(errors.length){
        throw new Error(errors.join('\n'));
      }

      let assemblyProgram = program.compile();
      if(includeSystem){
        assemblyProgram = AssemblyProgram.concat([assemblyProgram, systemAssemblyProgram]);
      }

      const [ messages, binaryProgram ] = assemblyProgram.assemble();
      if(!binaryProgram){
        throw new Error(messages.toString() || 'internal error');
      }

      const memory = binaryProgram.encode();
      const vm = new VM({
        debug: true,
        cycles: cycles,
      });
      return await vm.run(memory);
    }
    catch(e){
      if(e.name === 'SyntaxError'){
        return `${e.location.filename}(${e.location.start.line}): ${e.message}`;
      }
      return `${e}`;
    }
  }

  function expectRunToBe(value: number, text: string, includeSystem: boolean = false, cycles?: number){
    return expect(run(text, includeSystem, cycles).then((n) => typeof n === 'string' ? n : Immediate.toString(n))).resolves.toBe(Immediate.toString(value));
  }

  function expectExpressionToBe(expr: string, value: number){
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
        var s = 'Hello!';
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
      global g: byte[] = 'Hello!';
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

  test('access shadowed global outside of namespace', () => {
    return expectRunToBe(44, `
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
        return capacity ar;
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

  test('stack allocate array, change len', () => {
    return expectRunToBe(5, `
      function main(): byte {
        var ar: byte[10];
        len ar = 5;
        return len ar;
      }
    `);
  });

  test('stack allocate array, change len (capacity)', () => {
    return expectRunToBe(10, `
      function main(): byte {
        var ar: byte[10];
        len ar = 5;
        return capacity ar;
      }
    `);
  });

  test('stack allocate array, change len invalid', () => {
    return expectRunToBe(Compiler.CAPACITY_ERROR, `
      function main(): byte {
        var ar: byte[10];
        len ar = 20;
        return 0;
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
    return expectRunToBe(0, `
      function main(): byte {
        var b = new byte [0x2000];
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
        return capacity b;
      }
    `, true);
  });

  test('heap allocate array (infer)', () => {
    return expectRunToBe(13, `
      function main(): byte {
        var b  = new byte [10];
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
        var ps = new Point[10];
        ps[3].x = 15;
        return ps[3].x;
      }
    `, true);
  });

  test('heap allocate array of structs (len)', () => {
    return expectRunToBe(13, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps = new Point[13];
        ps[3].x = 4;
        return len ps;
      }
    `, true);
  });

  test('heap allocate array of structs (capacity)', () => {
    return expectRunToBe(13, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps = new Point[13];
        ps[3].x = 4;
        return capacity ps;
      }
    `, true);
  });

  test('heap allocate array of structs with ellipsis', () => {
    return expectRunToBe(55, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps = new Point[10] ... Point {
          x = 55,
          y = 66,
        };
        return ps[3].x;
      }
    `, true);
  });

  test('heap allocate array of structs with initializer', () => {
    return expectRunToBe(4, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var ps = new Point[] = [
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
        var ps = new Point[] = [
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
        var ps = new Point[10] ... Point {
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
    return expectRunToBe(1, `
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
  })
});
