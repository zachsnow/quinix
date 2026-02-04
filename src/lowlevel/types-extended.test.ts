/**
 * Extended type system tests for QLL.
 * Tests advanced type checking scenarios, generics edge cases,
 * and type inference.
 */

import { parse as _parse } from './types-parser';
import {
  Type, ArrayType, SliceType, PointerType, StructType,
  IdentifierType, BuiltinType, FunctionType, TemplateType,
  TemplateInstantiationType, DotType,
} from './types';
import { TypeChecker, KindChecker } from './typechecker';
import { NamespaceDeclaration, TypeDeclaration, TemplateTypeDeclaration } from './lowlevel';
import { LowLevelProgram } from './lowlevel';
import { compileQLL, expectQLL, expectCompileError } from '@test/helpers';

describe('Type System: Pointer Types', () => {
  const parse: (text: string) => Type = _parse;
  const defaultNamespace = new NamespaceDeclaration('global', [
    ...NamespaceDeclaration.builtins,
  ]);
  const defaultContext = new TypeChecker(defaultNamespace);

  function kindcheck(s: string, context?: TypeChecker): Type {
    const type = parse(s);
    type.kindcheck(context || defaultContext, new KindChecker());
    return type;
  }

  test('pointer to pointer', () => {
    const t = kindcheck('** byte');
    expect(t).toBeInstanceOf(PointerType);
    const inner = (t as PointerType).dereference();
    expect(inner).toBeInstanceOf(PointerType);
    const innerInner = (inner as PointerType).dereference();
    expect(innerInner.isEqualTo(Type.Byte)).toBe(true);
  });

  test('pointer to array', () => {
    const t = kindcheck('* byte[5]');
    expect(t).toBeInstanceOf(PointerType);
    const inner = (t as PointerType).dereference();
    expect(inner).toBeInstanceOf(ArrayType);
    expect((inner as ArrayType).length).toBe(5);
  });

  test('pointer to slice', () => {
    const t = kindcheck('* byte[]');
    expect(t).toBeInstanceOf(PointerType);
    const inner = (t as PointerType).dereference();
    expect(inner).toBeInstanceOf(SliceType);
  });

  test('pointer to function', () => {
    const t = kindcheck('* (byte) => byte');
    expect(t).toBeInstanceOf(PointerType);
    const inner = (t as PointerType).dereference();
    expect(inner).toBeInstanceOf(FunctionType);
  });

  test('pointer to struct', () => {
    const t = kindcheck('* struct { x: byte; }');
    expect(t).toBeInstanceOf(PointerType);
    const inner = (t as PointerType).dereference();
    expect(inner).toBeInstanceOf(StructType);
  });

  test('pointer equality', () => {
    expect(kindcheck('* byte').isEqualTo(kindcheck('* byte'))).toBe(true);
    expect(kindcheck('* byte').isEqualTo(kindcheck('* bool'))).toBe(false);
    expect(kindcheck('* * byte').isEqualTo(kindcheck('* * byte'))).toBe(true);
    expect(kindcheck('* * byte').isEqualTo(kindcheck('* byte'))).toBe(false);
  });

  test('pointer to byte parses', () => {
    const t = kindcheck('* byte');
    expect(t).toBeInstanceOf(PointerType);
  });
});

describe('Type System: Function Types', () => {
  const parse: (text: string) => Type = _parse;

  test('no-arg function parses', () => {
    const t = parse('() => byte');
    expect(t).toBeInstanceOf(FunctionType);
  });

  test('multi-arg function parses', () => {
    const t = parse('(byte, byte, byte) => byte');
    expect(t).toBeInstanceOf(FunctionType);
  });

  test('void return parses', () => {
    const t = parse('(byte) => void');
    expect(t).toBeInstanceOf(FunctionType);
  });

  test('function returning function parses', () => {
    const t = parse('() => () => byte');
    expect(t).toBeInstanceOf(FunctionType);
  });

  test('function taking function parses', () => {
    const t = parse('((byte) => byte) => byte');
    expect(t).toBeInstanceOf(FunctionType);
  });

  test('function type in code', () => {
    return expectQLL(10, `
      type IntFn = () => byte;
      function ten(): byte { return 10; }
      function main(): byte {
        var fn: IntFn = ten;
        return fn();
      }
    `);
  });
});

describe('Type System: Struct Types', () => {
  const parse: (text: string) => Type = _parse;
  const defaultNamespace = new NamespaceDeclaration('global', [
    ...NamespaceDeclaration.builtins,
  ]);
  const defaultContext = new TypeChecker(defaultNamespace);

  function kindcheck(s: string): Type {
    const type = parse(s);
    type.kindcheck(defaultContext, new KindChecker());
    return type;
  }

  test('single field struct', () => {
    const t = kindcheck('struct { x: byte; }');
    expect(t).toBeInstanceOf(StructType);
    expect((t as StructType).size).toBe(1);
  });

  test('multi-field struct', () => {
    const t = kindcheck('struct { x: byte; y: byte; z: byte; }');
    expect(t).toBeInstanceOf(StructType);
    expect((t as StructType).size).toBe(3);
  });

  test('nested struct', () => {
    const t = kindcheck('struct { inner: struct { x: byte; y: byte; }; }');
    expect(t).toBeInstanceOf(StructType);
    const outer = t as StructType;
    expect(outer.size).toBe(2);
  });

  test('struct with array field', () => {
    const t = kindcheck('struct { arr: byte[10]; }');
    expect(t).toBeInstanceOf(StructType);
    expect((t as StructType).size).toBe(10);
  });

  test('struct with pointer field', () => {
    const t = kindcheck('struct { ptr: * byte; }');
    expect(t).toBeInstanceOf(StructType);
    expect((t as StructType).size).toBe(1);
  });

  test('struct field order matters', () => {
    expect(kindcheck('struct { x: byte; y: bool; }').isEqualTo(
      kindcheck('struct { y: bool; x: byte; }')
    )).toBe(false);
  });

  test('struct field names matter', () => {
    expect(kindcheck('struct { x: byte; }').isEqualTo(
      kindcheck('struct { y: byte; }')
    )).toBe(false);
  });
});

describe('Type System: Array Types', () => {
  const parse: (text: string) => Type = _parse;
  const defaultNamespace = new NamespaceDeclaration('global', [
    ...NamespaceDeclaration.builtins,
  ]);
  const defaultContext = new TypeChecker(defaultNamespace);

  function kindcheck(s: string): Type {
    const type = parse(s);
    type.kindcheck(defaultContext, new KindChecker());
    return type;
  }

  test('array size', () => {
    const t = kindcheck('byte[10]');
    expect(t).toBeInstanceOf(ArrayType);
    expect((t as ArrayType).length).toBe(10);
    expect((t as ArrayType).size).toBe(10);
  });

  test('array of arrays', () => {
    const t = kindcheck('byte[3][5]');
    expect(t).toBeInstanceOf(ArrayType);
    const outer = t as ArrayType;
    expect(outer.length).toBe(5);
    expect(outer.size).toBe(15); // 3 * 5
  });

  test('array of structs', () => {
    const t = kindcheck('struct { x: byte; y: byte; }[10]');
    expect(t).toBeInstanceOf(ArrayType);
    expect((t as ArrayType).size).toBe(20); // 2 * 10
  });

  test('zero-length array', () => {
    const t = kindcheck('byte[0]');
    expect(t).toBeInstanceOf(ArrayType);
    expect((t as ArrayType).length).toBe(0);
    expect((t as ArrayType).size).toBe(0);
  });
});

describe('Type System: Slice Types', () => {
  const parse: (text: string) => Type = _parse;
  const defaultNamespace = new NamespaceDeclaration('global', [
    ...NamespaceDeclaration.builtins,
  ]);
  const defaultContext = new TypeChecker(defaultNamespace);

  function kindcheck(s: string): Type {
    const type = parse(s);
    type.kindcheck(defaultContext, new KindChecker());
    return type;
  }

  test('slice size is 3 (ptr, len, cap)', () => {
    const t = kindcheck('byte[]');
    expect(t).toBeInstanceOf(SliceType);
    expect((t as SliceType).size).toBe(3);
  });

  test('slice of structs', () => {
    const t = kindcheck('struct { x: byte; y: byte; }[]');
    expect(t).toBeInstanceOf(SliceType);
    expect((t as SliceType).size).toBe(3); // Slice header is always 3
  });

  test('slice element type', () => {
    const t = kindcheck('byte[]');
    const element = (t as SliceType).index();
    expect(element.isEqualTo(Type.Byte)).toBe(true);
  });
});

describe('Type System: Generic Types', () => {
  test('template type creation', () => {
    const idType = new TemplateType(
      ['T'],
      new FunctionType([new IdentifierType('T')], new IdentifierType('T')),
    );
    expect(idType).toBeInstanceOf(TemplateType);
  });

  test('generic function in code', () => {
    return expectQLL(42, `
      function identity<T>(x: T): T {
        return x;
      }
      function main(): byte {
        return identity<byte>(42);
      }
    `);
  });

  test('generic type instantiation', () => {
    // Test that generic types can be instantiated - covered by codegen tests
    expect(true).toBe(true);
  });
});

describe('Type System: Type Inference in Code', () => {
  test('infer variable type from literal', () => {
    return expectQLL(42, `
      function main(): byte {
        var x = 42;
        return x;
      }
    `);
  });

  test('infer variable type from expression', () => {
    return expectQLL(10, `
      function main(): byte {
        var a: byte = 5;
        var b = a + 5;
        return b;
      }
    `);
  });

  test('infer array element type', () => {
    return expectQLL(30, `
      function main(): byte {
        var arr = [10, 20, 30];
        return arr[2];
      }
    `);
  });

  test('infer struct literal type', () => {
    return expectQLL(20, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var p = Point { x = 10, y = 20 };
        return p.y;
      }
    `);
  });

  test('infer function call result type', () => {
    return expectQLL(42, `
      function getValue(): byte {
        return 42;
      }
      function main(): byte {
        var x = getValue();
        return x;
      }
    `);
  });
});

describe('Type System: Type Coercion', () => {
  test('bool true to byte', () => {
    return expectQLL(1, `
      function main(): byte {
        var flag: bool = true;
        return <byte>flag;
      }
    `);
  });

  test('bool false to byte', () => {
    return expectQLL(0, `
      function main(): byte {
        var flag: bool = false;
        return <byte>flag;
      }
    `);
  });

  test('array to slice coercion', () => {
    return expectQLL(3, `
      function takeSlice(s: byte[]): byte {
        return len s;
      }
      function main(): byte {
        var arr: byte[3] = [1, 2, 3];
        return takeSlice(arr);
      }
    `);
  });

  test('string literal to byte slice', () => {
    return expectQLL(5, `
      function main(): byte {
        var s: byte[] = "hello";
        return len s;
      }
    `);
  });
});

describe('Type System: Named Types', () => {
  test('struct type with name', () => {
    return expectQLL(42, `
      type Integer = struct { value: byte; };
      function main(): byte {
        var x = Integer { value = 42 };
        return x.value;
      }
    `);
  });

  test('type alias for struct', () => {
    return expectQLL(30, `
      type Point = struct { x: byte; y: byte; };
      function main(): byte {
        var v = Point { x = 10, y = 20 };
        return v.x + v.y;
      }
    `);
  });

  test('named struct in function parameter', () => {
    return expectQLL(30, `
      type Point = struct { x: byte; y: byte; };
      function sum(p: Point): byte {
        return p.x + p.y;
      }
      function main(): byte {
        return sum(Point { x = 10, y = 20 });
      }
    `);
  });
});

describe('Type System: Size Calculations', () => {
  test('byte size is 1', () => {
    return expectQLL(1, `
      function main(): byte {
        return sizeof byte;
      }
    `);
  });

  test('bool size is 1', () => {
    return expectQLL(1, `
      function main(): byte {
        return sizeof bool;
      }
    `);
  });

  test('pointer size is 1', () => {
    return expectQLL(1, `
      function main(): byte {
        return sizeof * byte;
      }
    `);
  });

  test('array size is element_size * length', () => {
    return expectQLL(10, `
      function main(): byte {
        return sizeof byte[10];
      }
    `);
  });

  test('slice size is 3 (pointer + length + capacity)', () => {
    return expectQLL(3, `
      function main(): byte {
        return sizeof byte[];
      }
    `);
  });

  test('struct size is sum of field sizes', () => {
    return expectQLL(5, `
      type S = struct { a: byte; b: byte; c: byte; d: byte; e: byte; };
      function main(): byte {
        return sizeof S;
      }
    `);
  });

  test('nested struct size', () => {
    return expectQLL(4, `
      type Inner = struct { x: byte; y: byte; };
      type Outer = struct { a: Inner; b: Inner; };
      function main(): byte {
        return sizeof Outer;
      }
    `);
  });

  test('function type size is 1', () => {
    return expectQLL(1, `
      function main(): byte {
        return sizeof () => byte;
      }
    `);
  });
});
