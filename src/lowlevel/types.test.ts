import { parse as _parse } from './types-parser';
import { Type, ArrayType, PointerType, StructType, IdentifierType, BuiltinType, FunctionType } from './types';
import { TypeChecker, KindChecker } from './typechecker';
import { IdentifierExpression } from './expressions';

const parse: (text: string) => Type = _parse;

describe('Types', () => {
  test('parse', () => {
    expect(parse('byte')).toBeInstanceOf(BuiltinType);
    expect(parse('byte').toString()).toBe('byte');

    expect(parse('bool')).toBeInstanceOf(BuiltinType);
    expect(parse('bool').toString()).toBe('bool');

    expect(parse('void')).toBeInstanceOf(BuiltinType);
    expect(parse('void').toString()).toBe('void');

    expect(parse('byte[]')).toBeInstanceOf(ArrayType);
    expect(parse('byte[]').toString()).toBe('byte[]');

    expect(parse('struct { x: byte; }')).toBeInstanceOf(StructType);
    expect(parse('struct { x: byte; }').toString()).toBe(`struct {\n  x: byte;\n}`);

    expect(parse('* byte')).toBeInstanceOf(PointerType);
    expect(parse('* byte').toString()).toBe('* byte');

    expect(parse('** byte')).toBeInstanceOf(PointerType);
    expect(parse('* * byte').toString()).toBe('* * byte');

    expect(parse('*byte[]')).toBeInstanceOf(PointerType);
    expect((parse('*byte[]') as PointerType).dereference()).toBeInstanceOf(ArrayType);
    expect(parse('* byte []').toString()).toBe('* byte[]');

    expect(parse('(byte, byte) => int')).toBeInstanceOf(FunctionType);
    expect(parse('(byte, byte) => int').toString()).toBe('(byte, byte) => int');
  });

  test('invalid recursive type: type int = int', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('int'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors[0].text).toBe(`recursive type int`);
  });

  test('invalid recursive type: type int = number; type number = int;', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('number'));
    context.typeTable.set('number', parse('int'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors[0].text).toBe(`recursive type int`);
  });

  test('invalid recursive type: type int = * int', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('* int'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors[0].text).toBe(`recursive type int`);
  });

  test('invalid recursive type: type int = * number; type number = int;', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('* number'));
    context.typeTable.set('number', parse('int'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors[0].text).toBe(`recursive type int`);
  });

  test('invalid recursive type: type int = struct { x: int; }', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('struct { x: int; }'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors[0].text).toBe(`recursive type int`);
  });

  test('invalid recursive type: type int = int[]', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('int[]'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors[0].text).toBe(`recursive type int`);
  });

  test('valid recursive type: type int = struct { x: int[]; }', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('struct { x: int[]; }'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors.length).toBe(0);
  });

  test('valid recursive type: type int = struct { x: * int; }', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('int', parse('struct { x: * int; }'));
    parse('int').kindcheck(context, new KindChecker());
    expect(context.errors.length).toBe(0);
  });

  test('valid recursive type: type point = struct { x: byte; y: byte; add: (byte, byte) => point; };', () => {
    const context = new TypeChecker(undefined, undefined, 'test');
    context.typeTable.set('point', parse('struct { x: byte; y: byte; add: (byte, byte) => point; }'));
    parse('point').kindcheck(context, new KindChecker());
    expect(context.errors.length).toBe(0);
  });

  const t1 = new IdentifierType('t1');

  test('build array', () => {
    expect(ArrayType.build(t1, [])).toBe(t1);

    expect(ArrayType.build(t1, [undefined])).toBeInstanceOf(ArrayType);

    let parsed = ArrayType.build(t1, [7, undefined]);
    expect(parsed).toBeInstanceOf(ArrayType);

    let t = parsed as ArrayType;
    expect(t.index()).toBeInstanceOf(ArrayType);
    expect(t.length === undefined);

    const nested = t.index() as ArrayType;
    expect(nested.index()).toBe(t1);
    expect(nested.length === 7);
  });

  describe('templates', () => {
    test('simple instantiation', () => {
      const instantiations: FunctionType[] = [];
      var f = new FunctionType(
        ['A', 'B'],
        [new IdentifierType('A'), new PointerType(new IdentifierType('B'))],
        new IdentifierType('B'),
        [(context, type) => { instantiations.push(type); }],
      );
      expect(f.toString()).toBe('<A, B>(A, * B) => B');


      const context = new TypeChecker();
      f.kindcheck(context, new KindChecker());
      expect(f.instantiate(context, [ Type.Byte, t1 ]).toString()).toBe('(byte, * t1) => t1');

      expect(instantiations.length).toBe(1);
    });

    test('invalid definition: duplicate type variables', () => {
      const instantiations: FunctionType[] = [];
      var f = new FunctionType(
        ['A', 'A'],
        [new IdentifierType('A')],
        new IdentifierType('A'),
        [(context, type) => { instantiations.push(type); }],
      );
      const context = new TypeChecker();
      f.kindcheck(context, new KindChecker());
      expect(context.errors.map((e) => e.text)).toContain('duplicate type variables A');
    });

    test('invalid instantiation: void', () => {
      const instantiations: FunctionType[] = [];
      var f = new FunctionType(
        ['A'],
        [new IdentifierType('A')],
        Type.Byte,
        [(context, type) => { instantiations.push(type); }],
      );
      const context = new TypeChecker();
      f.kindcheck(context, new KindChecker());
      const type = f.instantiate(context, [Type.Void]);
      expect(context.errors.map((e) => e.text)).toContain('invalid void argument');
      expect(instantiations.length).toBe(1);
    });
  });
});
