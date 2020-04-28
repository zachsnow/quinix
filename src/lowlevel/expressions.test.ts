import { parse as _parse } from './expressions-parser';
import {
  ArrayType,
} from './types';
import { Expression, BinaryExpression,
  IntLiteralExpression, BoolLiteralExpression, StringLiteralExpression,
  SuffixExpression, DotExpression, ArrowExpression, IndexExpression,
  NewExpression, NewArrayExpression,
} from './expressions';

const parse: (text: string) => Expression = _parse;

describe('Expressions', () => {
  const zero = new IntLiteralExpression(0);
  const one = new IntLiteralExpression(2);
  const two = new IntLiteralExpression(2);
  const range = {
    start: { line: 0, column: 0 },
  };
  const text = 'some expression';

  test('build binary', () => {
    expect(BinaryExpression.build(zero, [])).toBe(zero);

    let parsed = BinaryExpression.build(zero, [[ '+', one ], [ '-', two ]]);
    expect(parsed).toBeInstanceOf(BinaryExpression);

    let exp = parsed as BinaryExpression;
    expect(exp.operator).toBe('-')
    expect(exp.left).toBeInstanceOf(BinaryExpression);
    expect(exp.right).toBe(two);

    const left = exp.left as BinaryExpression;
    expect(left.operator).toBe('+');
    expect(left.left).toBe(zero);
    expect(left.right).toBe(one);
  });

  test('build no suffix', () => {
    expect(SuffixExpression.build(zero, [])).toBe(zero);
  });

  test('build dot', () => {
    let parsed = SuffixExpression.build(zero, [
      { identifier: 'foo', pointer: false, range, text },
      { identifier: 'bar', pointer: false, range, text },
      { identifier: 'baz', pointer: false, range, text },
    ]);
    expect(parsed).toBeInstanceOf(DotExpression);

    let exp = parsed as DotExpression;
    expect(exp.identifier).toBe('baz');
    expect(exp.expression).toBeInstanceOf(DotExpression);

    exp = exp.expression as DotExpression;
    expect(exp.identifier).toBe('bar');
    expect(exp.expression).toBeInstanceOf(DotExpression);

    exp = exp.expression as DotExpression;
    expect(exp.identifier).toBe('foo');
    expect(exp.expression).toBe(zero);
  });

  test('build arrow', () => {
    let parsed = SuffixExpression.build(zero, [
      { identifier: 'foo', pointer: true, range, text },
      { identifier: 'bar', pointer: true, range, text },
      { identifier: 'baz', pointer: true, range, text },
    ]);
    expect(parsed).toBeInstanceOf(ArrowExpression);

    let exp = parsed as ArrowExpression;
    expect(exp.identifier).toBe('baz');
    expect(exp.expression).toBeInstanceOf(ArrowExpression);

    exp = exp.expression as ArrowExpression;
    expect(exp.identifier).toBe('bar');
    expect(exp.expression).toBeInstanceOf(ArrowExpression);

    exp = exp.expression as ArrowExpression;
    expect(exp.identifier).toBe('foo');
    expect(exp.expression).toBe(zero);
  });

  test('build index', () => {
    const parsed = SuffixExpression.build(zero, [
      { index: one, range, text },
      { index: two, range, text },
    ]);
    expect(parsed).toBeInstanceOf(IndexExpression);

    let exp = parsed as IndexExpression;
    expect(exp.index).toBe(two);
    expect(exp.expression).toBeInstanceOf(IndexExpression);

    exp = exp.expression as IndexExpression;
    expect(exp.index).toBe(one);
    expect(exp.expression).toBe(zero);
  });

  test('build mixed suffix', () => {
    const parsed = SuffixExpression.build(zero, [
      { identifier: 'bar', pointer: true, range, text },
      { index: one, range, text },
      { identifier: 'foo', pointer: false, range, text },
    ]);
    expect(parsed).toBeInstanceOf(DotExpression);

    let dot = parsed as DotExpression;
    expect(dot.identifier).toBe('foo');
    expect(dot.expression).toBeInstanceOf(IndexExpression);

    let ind = dot.expression as IndexExpression;
    expect(ind.index).toBe(one);
    expect(ind.expression).toBeInstanceOf(ArrowExpression);

    let arr = ind.expression as ArrowExpression;
    expect(arr.identifier).toBe('bar');
    expect(arr.expression).toBe(zero);
  });

  test('bools', () => {
    const t = parse('true');
    expect(t).toBeInstanceOf(BoolLiteralExpression);
    expect(t.toString()).toBe('true');

    const f = parse('false');
    expect(f).toBeInstanceOf(BoolLiteralExpression);
    expect(f.toString()).toBe('false');
  });

  test('new byte', () => {
    const n = parse('new byte');
    expect(n).toBeInstanceOf(NewExpression);
    expect((n as any).type.toString()).toBe('byte');
    expect((n as any).size).toBeUndefined();
    expect((n as any).ellipsis).toBeFalsy();
    expect((n as any).expression).toBeUndefined();
  });

  test('new byte = 10', () => {
    const n = parse('new byte = 10');
    expect(n).toBeInstanceOf(NewExpression);
    expect((n as any).type.toString()).toBe('byte');
    expect((n as any).size).toBeUndefined();
    expect((n as any).ellipsis).toBeFalsy();
    expect((n as any).expression.toString()).toBe('10');
  });

  test('new byte [0x8000]', () => {
    const n = parse('new byte[0x8000]');
    expect(n).toBeInstanceOf(NewExpression);
    expect((n as any).type.toString()).toBe('byte[0x8000]');
    expect((n as any).expression).toBeUndefined();
  });

  test('new byte[n]', () => {
    const n = parse('new byte[n]');
    expect(n).toBeInstanceOf(NewArrayExpression);
    expect((n as any).type.toString()).toBe('byte[]');
    expect((n as any).size.toString()).toBe('n');
    expect((n as any).ellipsis).toBeFalsy();
    expect((n as any).expression).toBeUndefined();
  });

  test('new byte [n] ... e', () => {
    const n = parse('new byte [n] ... e');
    expect(n).toBeInstanceOf(NewArrayExpression);
    expect((n as any).type.toString()).toBe('byte[]');
    expect((n as any).size.toString()).toBe('n');
    expect((n as any).ellipsis).toBeTruthy();
    expect((n as any).expression.toString()).toBe('e');
  });

  test('new byte[] = [1,2,3]', () => {
    const n = parse('new byte[] = [1,2,3]');
    expect(n).toBeInstanceOf(NewArrayExpression);
    expect((n as any).type.toString()).toBe('byte[]');
    expect((n as any).size.toString()).toBe('3');
    expect((n as any).ellipsis).toBeFalsy();
    expect((n as any).expression.toString()).toBe(`[ 1, 2, 3 ]`);
  });
});
