import { parse as _parse } from './types-parser';
import {
  Type, ArrayType, PointerType, StructType,
  IdentifierType, BuiltinType, FunctionType, TemplateType,
  TemplateInstantiationType, DotType,
  SuffixType,
} from './types';
import { TypeChecker, KindChecker } from './typechecker';

describe('Types', () => {
  const parse: (text: string) => Type = _parse;

  function kindcheck(s: string, context?: TypeChecker): Type{
    const type = parse(s);
    type.elaborate(context || new TypeChecker());
    type.kindcheck(context || new TypeChecker(), new KindChecker());
    return type;
  }

  test('parse', () => {
    expect(parse('byte')).toBeInstanceOf(BuiltinType);
    expect(parse('byte').toString()).toBe('byte');

    expect(parse('bool')).toBeInstanceOf(IdentifierType);
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

    expect(parse('foo.bar')).toBeInstanceOf(DotType);
    expect(parse('foo.bar').toString()).toBe('(foo).bar');
    expect(parse('foo.bar[]')).toBeInstanceOf(ArrayType);
    expect(parse('foo.bar[]').toString()).toBe('(foo).bar[]');

    expect(parse('* vector<T>')).toBeInstanceOf(PointerType);
  });

  describe('Equality / Conversion', () => {
    test('identifier equality', () => {
      const context = new TypeChecker();
      context.typeTable.set('int', Type.Byte);

      // Equal to self.
      expect(kindcheck('byte').isEqualTo(kindcheck('byte'))).toBe(true);
      expect(kindcheck('void').isEqualTo(kindcheck('void'))).toBe(true);
      expect(kindcheck('bool').isEqualTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('string').isEqualTo(kindcheck('string'))).toBe(true);
      expect(kindcheck('int', context).isEqualTo(kindcheck('int', context))).toBe(true);

      // Not equal nominal binding.
      expect(kindcheck('byte').isEqualTo(kindcheck('bool'))).toBe(false);
      expect(kindcheck('bool').isEqualTo(kindcheck('byte'))).toBe(false);

      expect(kindcheck('byte[]').isEqualTo(kindcheck('string'))).toBe(false);
      expect(kindcheck('string').isEqualTo(kindcheck('byte[]'))).toBe(false);

      expect(kindcheck('byte').isEqualTo(kindcheck('int', context))).toBe(false);
      expect(kindcheck('int', context).isEqualTo(kindcheck('byte'))).toBe(false);
    });

    test('identifier ', () => {
      // Convertible to self.
      expect(kindcheck('byte').isConvertibleTo(kindcheck('byte'))).toBe(true);
      expect(kindcheck('void').isConvertibleTo(kindcheck('void'))).toBe(true);
      expect(kindcheck('bool').isConvertibleTo(kindcheck('bool'))).toBe(true);

      // Byte/bool are both numeric.
      expect(kindcheck('byte').isConvertibleTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('bool').isConvertibleTo(kindcheck('byte'))).toBe(true);

      // Void is not convertible to anything.
      expect(kindcheck('void').isConvertibleTo(kindcheck('bool'))).toBe(false);
      expect(kindcheck('void').isConvertibleTo(kindcheck('byte'))).toBe(false);
      expect(kindcheck('bool').isConvertibleTo(kindcheck('void'))).toBe(false);
      expect(kindcheck('byte').isConvertibleTo(kindcheck('void'))).toBe(false);

      // Strings are just byte arrays.
      expect(kindcheck('byte[]').isConvertibleTo(kindcheck('string'))).toBe(true);
      expect(kindcheck('string').isConvertibleTo(kindcheck('byte[]'))).toBe(true);
    });

    test('structs', () => {
      const context = new TypeChecker();
      context.typeTable.set('int', Type.Byte);

      expect(kindcheck('struct { x: byte; }').isConvertibleTo(kindcheck('struct { x: byte; }'))).toBe(true);
      expect(kindcheck('struct { x: byte; y: byte; }').isConvertibleTo(kindcheck('struct { x: byte; y: byte; }'))).toBe(true);
      expect(kindcheck('struct { x: byte; }').isEqualTo(kindcheck('struct { x: byte; }'))).toBe(true);
      expect(kindcheck('struct { x: byte; y: byte; }').isEqualTo(kindcheck('struct { x: byte; y: byte; }'))).toBe(true);

      expect(kindcheck('struct { x: byte; }').isConvertibleTo(kindcheck('struct { x: byte; y: byte; }'))).toBe(false);
      expect(kindcheck('struct { x: byte; y: byte; }').isConvertibleTo(kindcheck('struct { x: byte; }'))).toBe(false);
      expect(kindcheck('struct { x: byte; }').isEqualTo(kindcheck('struct { x: byte; y: byte; }'))).toBe(false);
      expect(kindcheck('struct { x: byte; y: byte; }').isEqualTo(kindcheck('struct { x: byte; }'))).toBe(false);

      expect(kindcheck('struct { x: bool; }').isConvertibleTo(kindcheck('struct { x: byte; }'))).toBe(true);
      expect(kindcheck('struct { x: bool; }').isEqualTo(kindcheck('struct { x: byte; }'))).toBe(false);
      expect(kindcheck('struct { x: byte; }').isConvertibleTo(kindcheck('struct { x: bool; }'))).toBe(true);
      expect(kindcheck('struct { x: byte; }').isEqualTo(kindcheck('struct { x: bool; }'))).toBe(false);

      expect(kindcheck('(struct { x: bool; }).x').isEqualTo(kindcheck('byte'))).toBe(false);
      expect(kindcheck('(struct { x: bool; }).x').isEqualTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('(struct { x: bool; }).x').isConvertibleTo(kindcheck('byte'))).toBe(true);
      expect(kindcheck('(struct { x: bool; }).x').isConvertibleTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('byte').isEqualTo(kindcheck('(struct { x: bool; }).x'))).toBe(false);
      expect(kindcheck('bool').isEqualTo(kindcheck('(struct { x: bool; }).x'))).toBe(true);
      expect(kindcheck('byte').isConvertibleTo(kindcheck('(struct { x: bool; }).x'))).toBe(true);
      expect(kindcheck('bool').isConvertibleTo(kindcheck('(struct { x: bool; }).x'))).toBe(true);

      const struct = kindcheck('struct { x: bool; }');
      context.typeTable.set('s', struct);
      expect(kindcheck('s.x', context).isEqualTo(kindcheck('byte'))).toBe(false);
      expect(kindcheck('s.x', context).isEqualTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('s.x', context).isConvertibleTo(kindcheck('byte'))).toBe(true);
      expect(kindcheck('s.x', context).isConvertibleTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('byte').isEqualTo(kindcheck('s.x', context))).toBe(false);
      expect(kindcheck('bool').isEqualTo(kindcheck('s.x', context))).toBe(true);
      expect(kindcheck('byte').isConvertibleTo(kindcheck('s.x', context))).toBe(true);
      expect(kindcheck('bool').isConvertibleTo(kindcheck('s.x', context))).toBe(true);

      const deepStruct = kindcheck('struct { x: struct { y: bool; }; }');
      context.typeTable.set('d', deepStruct);
      expect(kindcheck('d.x.y', context).isEqualTo(kindcheck('byte'))).toBe(false);
      expect(kindcheck('d.x.y', context).isEqualTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('d.x.y', context).isConvertibleTo(kindcheck('byte'))).toBe(true);
      expect(kindcheck('d.x.y', context).isConvertibleTo(kindcheck('bool'))).toBe(true);
      expect(kindcheck('byte').isEqualTo(kindcheck('d.x.y', context))).toBe(false);
      expect(kindcheck('bool').isEqualTo(kindcheck('d.x.y', context))).toBe(true);
      expect(kindcheck('byte').isConvertibleTo(kindcheck('d.x.y', context))).toBe(true);
      expect(kindcheck('bool').isConvertibleTo(kindcheck('d.x.y', context))).toBe(true);
    });

    test('templates', () => {
      const context = new TypeChecker();

      const f = new FunctionType(
        [ new IdentifierType('T') ],
        new IdentifierType('T'),
      );
      const idType = new TemplateType(['T'], f);

      context.typeTable.set('id', idType);
      f.elaborate(context);

      expect(kindcheck('id<byte>', context).isEqualTo(kindcheck('(byte) => byte'))).toBe(true);
      expect(kindcheck('id<byte>', context).isConvertibleTo(kindcheck('(byte) => byte'))).toBe(true);
      expect(kindcheck('id<bool>', context).isEqualTo(kindcheck('(byte) => byte'))).toBe(false);
      expect(kindcheck('id<bool>', context).isConvertibleTo(kindcheck('(byte) => byte'))).toBe(true);
    });

    test('sized/unsized arrays', () => {
      expect(kindcheck('byte[0]').isConvertibleTo(kindcheck('byte[0]'))).toBe(true);
      expect(kindcheck('byte[0]').isConvertibleTo(kindcheck('byte[1]'))).toBe(false);
      expect(kindcheck('byte[1]').isConvertibleTo(kindcheck('byte[0]'))).toBe(false);

      expect(kindcheck('byte[0]').isEqualTo(kindcheck('byte[0]'))).toBe(true);
      expect(kindcheck('byte[0]').isEqualTo(kindcheck('byte[1]'))).toBe(false);
      expect(kindcheck('byte[1]').isEqualTo(kindcheck('byte[0]'))).toBe(false);

      expect(kindcheck('byte[]').isConvertibleTo(kindcheck('byte[1]'))).toBe(false);
      expect(kindcheck('byte[1]').isConvertibleTo(kindcheck('byte[]'))).toBe(true);
      expect(kindcheck('byte[]').isConvertibleTo(kindcheck('byte[]'))).toBe(true);

      expect(kindcheck('byte[]').isEqualTo(kindcheck('byte[1]'))).toBe(false);
      expect(kindcheck('byte[1]').isEqualTo(kindcheck('byte[]'))).toBe(true);
      expect(kindcheck('byte[]').isEqualTo(kindcheck('byte[]'))).toBe(true);

      expect(kindcheck('byte[]').isEqualTo(kindcheck('bool[]'))).toBe(false);
      expect(kindcheck('byte[]').isConvertibleTo(kindcheck('bool[]'))).toBe(true);
      expect(kindcheck('bool[]').isEqualTo(kindcheck('byte[]'))).toBe(false);
      expect(kindcheck('bool[]').isConvertibleTo(kindcheck('byte[]'))).toBe(true);
    });

    test('functions', () => {
      expect(kindcheck('() => void').isEqualTo(kindcheck('() => void'))).toBe(true);
      expect(kindcheck('() => byte').isEqualTo(kindcheck('() => byte'))).toBe(true);
      expect(kindcheck('() => byte').isEqualTo(kindcheck('() => bool'))).toBe(false);
      expect(kindcheck('() => byte').isConvertibleTo(kindcheck('() => bool'))).toBe(true);
    });
  });

  describe('Kindchecking', () => {
    test('invalid recursive type: type int = int', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('int');
      context.typeTable.set('int', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors[0].text).toBe(`recursive type int`);
    });

    test('invalid recursive type: type int = number; type number = int;', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const n = parse('number');
      const i = parse('int');
      context.typeTable.set('int', n);
      context.typeTable.set('number', i);
      n.elaborate(context);
      i.elaborate(context);
      n.kindcheck(context, new KindChecker());
      i.kindcheck(context, new KindChecker());
      expect(context.errors[0].text).toBe(`recursive type number`);
      expect(context.errors[1].text).toBe(`recursive type int`);
    });

    test('invalid recursive type: type int = * int', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('* int');
      context.typeTable.set('int', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors[0].text).toBe(`recursive type int`);
    });

    test('invalid recursive type: type int = * number; type number = int;', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const pn = parse('* number');
      const i = parse('int');
      context.typeTable.set('int', pn);
      context.typeTable.set('number', i);
      i.elaborate(context);
      pn.elaborate(context);
      i.kindcheck(context, new KindChecker());
      pn.kindcheck(context, new KindChecker());
      expect(context.errors[0].text).toBe(`recursive type int`);
      expect(context.errors[1].text).toBe(`recursive type number`);
    });

    test('invalid recursive type: type int = struct { x: int; }', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('struct { x: int; }');
      context.typeTable.set('int', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors[0].text).toBe(`recursive type int`);
    });

    test('invalid recursive type: type int = int[]', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('int[]');
      context.typeTable.set('int', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors[0].text).toBe(`recursive type int`);
    });

    test('valid recursive type: type int = struct { x: int[]; }', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('struct { x: int[]; }');
      context.typeTable.set('int', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors.length).toBe(0);
    });

    test('valid recursive type: type int = struct { x: * int; }', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('struct { x: * int; }');
      context.typeTable.set('int', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors.length).toBe(0);
    });

    test('valid recursive type: type point = struct { x: byte; y: byte; add: (byte, byte) => point; };', () => {
      const context = new TypeChecker(undefined, undefined, 'test');
      const t = parse('struct { x: byte; y: byte; add: (byte, byte) => point; }');
      context.typeTable.set('point', t);
      t.elaborate(context);
      t.kindcheck(context, new KindChecker());
      expect(context.errors.length).toBe(0);
    });
  });

  const range = {
    start: { line: 0, column: 0 },
  };
  const text = 'some expression';

  test('build array', () => {
    const t1 = new IdentifierType('t1');
    expect(SuffixType.build(t1, [])).toBe(t1);

    expect(SuffixType.build(t1, [{ size: undefined, range, text }])).toBeInstanceOf(ArrayType);

    let parsed = SuffixType.build(t1, [{ size: 7, range, text }, {size: undefined, range, text }]);
    expect(parsed).toBeInstanceOf(ArrayType);

    let t = parsed as ArrayType;
    expect(t.index()).toBeInstanceOf(ArrayType);
    expect(t.length === undefined);

    const nested = t.index() as ArrayType;
    expect(nested.index()).toBe(t1);
    expect(nested.length === 7);
  });

  describe('dots', () => {
    test('simple dotted type', () => {
      const instantiations: Type[] = [];
      const s = new StructType(
        [ { identifier: 'foo', type: Type.Byte }]
      );
      const d = new DotType(s, 'foo');
      const context = new TypeChecker();
      d.kindcheck(context, new KindChecker());

      expect(d.resolve()).toBe(Type.Byte);
      expect(d.toString().replace(/\n/g, '')).toBe('(struct {  foo: byte;}).foo');
    });
  });

  describe('templates', () => {
    test('simple instantiation', () => {
      const t1 = new IdentifierType('t');
      const instantiations: Type[] = [];
      var f = new TemplateType(
        ['A', 'B'],
        new FunctionType(
          [new IdentifierType('A'), new PointerType(new IdentifierType('B'))],
          new IdentifierType('B'),
        ),
        [(type) => { instantiations.push(type); }],
      );
      expect(f.toString()).toBe('<A, B>(A, * B) => B');


      const context = new TypeChecker();
      context.typeTable.set('t', Type.Byte);
      expect(f.instantiate(context, [ Type.Byte, t1 ]).toString()).toBe('(byte, * t) => t');

      expect(instantiations.length).toBe(1);
    });

    test('simple instantiation type', () => {
      const context = new TypeChecker();
      const t = new IdentifierType('t');
      const instantiations: Type[] = [];
      var f = new TemplateType(
        ['A', 'B'],
        new FunctionType(
          [new IdentifierType('A'), new PointerType(new IdentifierType('B'))],
          new IdentifierType('B'),
        ),
        [(type) => { instantiations.push(type); }],
      );

      expect(f.toString()).toBe('<A, B>(A, * B) => B');

      const instantiationType = new TemplateInstantiationType(
        f,
        [ Type.Byte, t ],
      );
      expect(instantiationType.toString()).toBe('(<A, B>(A, * B) => B)<byte, t>')

      instantiationType.elaborate(context);
      instantiationType.kindcheck(context, new KindChecker());
      context.typeTable.set('t1', Type.Byte);
      expect(instantiationType.resolve().toString()).toBe('(byte, * t) => t');
      expect(instantiations.length).toBe(1);
    });
  });
});
