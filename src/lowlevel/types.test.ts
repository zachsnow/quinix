import { parse as _parse } from './types-parser';
import { Type, ArrayType, PointerType, StructType, IdentifierType, BuiltinType, FunctionType } from './types';
import { TypeChecker, KindChecker } from './typechecker';

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
});
