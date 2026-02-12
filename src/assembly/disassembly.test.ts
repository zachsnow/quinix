/**
 * Disassembler tests.
 * Tests round-trip: assemble → binary → disassemble → reassemble → same binary.
 */

import { AssemblyProgram } from '@/assembly/assembly';
import { Disassembler } from '@/assembly/disassembly';

function assemble(source: string): Uint32Array {
  const program = AssemblyProgram.parse(source, 'test.qasm');
  const [messages, binary] = program.assemble();
  if (!binary) {
    throw new Error(`Assembly failed: ${messages.errors.map(e => e.text).join(', ')}`);
  }
  return binary.encode();
}

function roundTrip(source: string): { original: Uint32Array; reassembled: Uint32Array; disassembled: string } {
  const original = assemble(source);
  const disassembler = new Disassembler(original);
  const disassembled = disassembler.disassemble();
  const reassembled = assemble(disassembled);
  return { original, reassembled, disassembled };
}

describe('Disassembler', () => {
  test('disassembles halt', () => {
    const binary = assemble('halt');
    const disassembler = new Disassembler(binary);
    const output = disassembler.disassemble();
    expect(output).toContain('halt');
  });

  test('disassembles arithmetic', () => {
    const binary = assemble('add r0 r1 r2');
    const disassembler = new Disassembler(binary);
    const output = disassembler.disassemble();
    expect(output).toContain('add');
    expect(output).toContain('r0');
    expect(output).toContain('r1');
    expect(output).toContain('r2');
  });

  test('disassembles constant with immediate', () => {
    const source = 'constant r0 0x0000002a\nhalt';
    const binary = assemble(source);
    const disassembler = new Disassembler(binary);
    const output = disassembler.disassemble();
    expect(output).toContain('constant');
    expect(output).toContain('r0');
    expect(output).toContain('0x0000002a');
  });

  test('disassembles data section with string', () => {
    const source = "data @msg 'Hello'\nconstant r0 @msg\nhalt";
    const binary = assemble(source);
    const disassembler = new Disassembler(binary);
    const output = disassembler.disassemble();
    expect(output).toContain('Hello');
  });
});

describe('Disassembler: round-trip', () => {
  test('simple halt', () => {
    const { original, reassembled } = roundTrip('halt');
    expect(reassembled).toEqual(original);
  });

  test('arithmetic instructions', () => {
    const source = [
      'constant r1 0x0000000a',
      'constant r2 0x00000014',
      'add r0 r1 r2',
      'halt',
    ].join('\n');
    const { original, reassembled } = roundTrip(source);
    expect(reassembled).toEqual(original);
  });

  test('branch with label in register', () => {
    const source = [
      'constant r0 0x00000001',
      'constant r1 @skip',
      'jnz r0 r1',
      'constant r2 0x000000ff',
      '@skip:',
      'halt',
    ].join('\n');
    const { original, reassembled } = roundTrip(source);
    expect(reassembled).toEqual(original);
  });

  test('multiple instructions', () => {
    const source = [
      'constant r1 0x00000005',
      'constant r2 0x00000003',
      'add r0 r1 r2',
      'sub r3 r1 r2',
      'mul r4 r1 r2',
      'halt',
    ].join('\n');
    const { original, reassembled } = roundTrip(source);
    expect(reassembled).toEqual(original);
  });

  test('data section with string literal', () => {
    const source = "data @msg 'Hi!'\nconstant r0 @msg\nhalt";
    const { original, reassembled } = roundTrip(source);
    expect(reassembled).toEqual(original);
  });

  test('load and store', () => {
    const source = [
      'constant r0 0x00002000',
      'constant r1 0x0000002a',
      'store r0 r1',
      'load r2 r0',
      'halt',
    ].join('\n');
    const { original, reassembled } = roundTrip(source);
    expect(reassembled).toEqual(original);
  });

  test('comparison and conditional jump', () => {
    const source = [
      'constant r1 0x0000000a',
      'constant r2 0x0000000a',
      'eq r0 r1 r2',
      'constant r3 @fail',
      'jz r0 r3',
      'constant r0 0x00000001',
      'halt',
      '@fail:',
      'constant r0 0x00000000',
      'halt',
    ].join('\n');
    const { original, reassembled } = roundTrip(source);
    expect(reassembled).toEqual(original);
  });
});
