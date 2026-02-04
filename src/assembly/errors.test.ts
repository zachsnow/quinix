/**
 * Error handling tests for the QASM assembler.
 * Tests parser errors, assembly errors, and error messages.
 */

import { parse } from './parser';
import { AssemblyProgram } from './assembly';

describe('QASM Parser Errors', () => {
  test('invalid instruction', () => {
    expect(() => parse('invalid_instruction r0 r1')).toThrow();
  });

  test('missing register argument', () => {
    expect(() => parse('add r0 r1')).toThrow();
  });

  test('invalid register name', () => {
    expect(() => parse('mov rx r1')).toThrow();
  });

  test('invalid immediate value', () => {
    expect(() => parse('constant r0 xyz')).toThrow();
  });

  test('unclosed string in data directive', () => {
    expect(() => parse("data @str 'unclosed")).toThrow();
  });

  test('missing label name', () => {
    expect(() => parse('@:')).toThrow();
  });

  test('labels can be referenced', () => {
    const program = parse(`
      @foo:
      constant r0 @foo
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });
});

describe('QASM Assembly Errors', () => {
  test('unknown reference', () => {
    const program = parse(`
      constant r0 @unknown
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBeGreaterThan(0);
    expect(messages.errors[0].text).toContain('unknown');
    expect(binary).toBeUndefined();
  });

  test('multiple unknown references', () => {
    const program = parse(`
      constant r0 @foo
      constant r1 @bar
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(2);
    expect(binary).toBeUndefined();
  });
});

describe('QASM Valid Programs', () => {
  test('empty program', () => {
    const program = parse('');
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('single halt', () => {
    const program = parse('halt');
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('label and reference', () => {
    const program = parse(`
      @start:
      constant r0 @start
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('forward reference', () => {
    const program = parse(`
      constant r0 @end
      nop
      @end:
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('data directive', () => {
    const program = parse(`
      data @message 'Hello'
      constant r0 @message
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('numeric data directive', () => {
    const program = parse(`
      data @values 0x1234
      constant r0 @values
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('hex constant', () => {
    const program = parse(`
      constant r0 0x1234
      halt
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });

  test('comments are ignored', () => {
    const program = parse(`
      ; This is a comment
      halt  ; inline comment
    `);
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
    expect(binary).not.toBeUndefined();
  });
});

describe('QASM Instruction Coverage', () => {
  // Test that all basic instructions can be parsed
  const instructions = [
    'halt',
    'nop',
    'wait',
    'int r0',
    'load r0 r1',
    'store r0 r1',
    'mov r0 r1',
    'constant r0 42',
    'add r0 r1 r2',
    'sub r0 r1 r2',
    'mul r0 r1 r2',
    'div r0 r1 r2',
    'mod r0 r1 r2',
    'and r0 r1 r2',
    'or r0 r1 r2',
    'not r0 r1',
    'shl r0 r1 r2',
    'shr r0 r1 r2',
    'eq r0 r1 r2',
    'neq r0 r1 r2',
    'lt r0 r1 r2',
    'gt r0 r1 r2',
    'jmp r0',
    'jz r0 r1',
    'jnz r0 r1',
  ];

  instructions.forEach(instruction => {
    test(`parses: ${instruction}`, () => {
      const program = parse(`${instruction}\nhalt`);
      const [messages, binary] = program.assemble();
      expect(messages.errors.length).toBe(0);
      expect(binary).not.toBeUndefined();
    });
  });
});

describe('QASM Float Instructions', () => {
  const floatInstructions = [
    'fadd r0 r1 r2',
    'fsub r0 r1 r2',
    'fmul r0 r1 r2',
    'fdiv r0 r1 r2',
    'feq r0 r1 r2',
    'flt r0 r1 r2',
    'fgt r0 r1 r2',
    'itof r0 r1',
    'utof r0 r1',
    'ftoi r0 r1',
  ];

  floatInstructions.forEach(instruction => {
    test(`parses: ${instruction}`, () => {
      const program = parse(`${instruction}\nhalt`);
      const [messages, binary] = program.assemble();
      expect(messages.errors.length).toBe(0);
      expect(binary).not.toBeUndefined();
    });
  });
});

describe('QASM Register Parsing', () => {
  test('generic registers r0-r63', () => {
    // Test a few representative registers
    [0, 1, 31, 62, 63].forEach(n => {
      const program = parse(`mov r${n} r0\nhalt`);
      const [messages, binary] = program.assemble();
      expect(messages.errors.length).toBe(0);
    });
  });

  test('ip register', () => {
    const program = parse('mov r0 ip\nhalt');
    const [messages, binary] = program.assemble();
    expect(messages.errors.length).toBe(0);
  });
});
