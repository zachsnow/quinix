/**
 * Shared test utilities for Quinix test suite.
 * Provides common helpers for compiling, assembling, and running programs.
 */

import fs from 'fs';
import path from 'path';

import { VM, VMResult } from '@/vm/vm';
import { Instruction, Operation, Program, Register } from '@/vm/instructions';
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { Immediate, Address } from '@/lib/types';
import { Peripheral } from '@/vm/peripherals';

// === Path Constants ===

const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const PATHS = {
  bare: {
    entrypoint: path.join(ROOT_DIR, 'bare', 'entrypoint.qasm'),
    alloc: path.join(ROOT_DIR, 'bare', 'alloc.qll'),
    display: path.join(ROOT_DIR, 'bare', 'display.qll'),
    wait: path.join(ROOT_DIR, 'bare', 'wait.qll'),
  },
  user: {
    entrypoint: path.join(ROOT_DIR, 'user', 'entrypoint.qasm'),
    alloc: path.join(ROOT_DIR, 'user', 'alloc.qll'),
  },
  shared: {
    alloc: path.join(ROOT_DIR, 'shared', 'alloc.qll'),
    std: path.join(ROOT_DIR, 'shared', 'std.qll'),
    graphics: path.join(ROOT_DIR, 'shared', 'graphics.qll'),
  },
  kernel: path.join(ROOT_DIR, 'kernel', 'kernel.qll'),
};

// === Float Conversion Helpers ===

const floatBuffer = new ArrayBuffer(4);
const floatIntView = new Uint32Array(floatBuffer);
const floatFloatView = new Float32Array(floatBuffer);

export function floatToInt(f: number): number {
  floatFloatView[0] = f;
  return floatIntView[0];
}

export function intToFloat(i: number): number {
  floatIntView[0] = i >>> 0;
  return floatFloatView[0];
}

// === VM Helpers ===

export interface VMOptions {
  peripherals?: Peripheral[];
  cycles?: number;
  debug?: boolean;
}

/**
 * Run a sequence of VM instructions and return the value in R0.
 */
export async function runInstructions(
  instructions: Instruction[],
  options: VMOptions = {}
): Promise<number> {
  const program = new Program(instructions);
  const vm = new VM({
    debug: options.debug ?? false,
    cycles: options.cycles,
    peripherals: options.peripherals,
  });
  return vm.run(program.encode());
}

/**
 * Run instructions and dump memory at a specific address.
 */
export async function runAndDump(
  instructions: Instruction[],
  address: Address,
  count: number = 1,
  options: VMOptions = {}
): Promise<Uint32Array> {
  const program = new Program(instructions);
  const vm = new VM({
    debug: options.debug ?? false,
    cycles: options.cycles,
    peripherals: options.peripherals,
  });
  await vm.run(program.encode());
  return vm.dump(address, count);
}

/**
 * Create a binary operation test sequence.
 * Loads two constants, performs operation, halts with result in R0.
 */
export function binaryOp(op: Operation, left: number, right: number): Instruction[] {
  return [
    Instruction.createOperation(Operation.CONSTANT, 1),
    Instruction.createImmediate(left),
    Instruction.createOperation(Operation.CONSTANT, 2),
    Instruction.createImmediate(right),
    Instruction.createOperation(op, Register.R0, 1, 2),
    Instruction.createOperation(Operation.HALT),
  ];
}

/**
 * Create a unary operation test sequence.
 * Loads a constant, performs operation, halts with result in R0.
 */
export function unaryOp(op: Operation, value: number): Instruction[] {
  return [
    Instruction.createOperation(Operation.CONSTANT, 1),
    Instruction.createImmediate(value),
    Instruction.createOperation(op, Register.R0, 1),
    Instruction.createOperation(Operation.HALT),
  ];
}

// === Assembly Helpers ===

export interface AssembleResult {
  success: boolean;
  errors: string[];
  binary?: Uint32Array;
}

/**
 * Parse and assemble QASM source code.
 */
export function assembleQASM(source: string, filename: string = 'test.qasm'): AssembleResult {
  try {
    const program = AssemblyProgram.parse(source, filename);
    const [messages, binary] = program.assemble();

    if (!binary) {
      return {
        success: false,
        errors: messages.errors.map(e => e.text),
      };
    }

    return {
      success: true,
      errors: [],
      binary: binary.encode(),
    };
  } catch (e: any) {
    return {
      success: false,
      errors: [e.message],
    };
  }
}

/**
 * Assemble and run QASM source, returning the exit code.
 */
export async function runQASM(
  source: string,
  options: VMOptions = {}
): Promise<VMResult | string> {
  const result = assembleQASM(source);
  if (!result.success || !result.binary) {
    return result.errors.join('\n');
  }

  const vm = new VM({
    debug: options.debug ?? false,
    cycles: options.cycles,
    peripherals: options.peripherals,
  });
  return vm.run(result.binary);
}

// === QLL Compilation Helpers ===

export interface CompileResult {
  success: boolean;
  errors: string[];
  assembly?: AssemblyProgram;
  binary?: Uint32Array;
}

// Cached entrypoint and allocator
let cachedBareEntrypoint: AssemblyProgram | null = null;
let cachedAllocator: LowLevelProgram | null = null;

function getBareEntrypoint(): AssemblyProgram {
  if (!cachedBareEntrypoint) {
    const text = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    cachedBareEntrypoint = AssemblyProgram.parse(text, PATHS.bare.entrypoint);
  }
  return cachedBareEntrypoint;
}

function getAllocator(): LowLevelProgram {
  if (!cachedAllocator) {
    const sharedText = fs.readFileSync(PATHS.shared.alloc, 'utf-8');
    const bareText = fs.readFileSync(PATHS.bare.alloc, 'utf-8');
    cachedAllocator = LowLevelProgram.concat([
      LowLevelProgram.parse(sharedText, PATHS.shared.alloc),
      LowLevelProgram.parse(bareText, PATHS.bare.alloc),
    ]);
  }
  return cachedAllocator;
}

/**
 * Compile QLL source to assembly.
 */
export function compileQLL(
  source: string,
  options: { includeAllocator?: boolean; filename?: string } = {}
): CompileResult {
  try {
    let programs = [LowLevelProgram.parse(source, options.filename ?? 'test.qll')];

    if (options.includeAllocator) {
      programs = [getAllocator(), ...programs];
    }

    const program = LowLevelProgram.concat(programs);
    const typeErrors = program.typecheck().errors;

    if (typeErrors.length) {
      return {
        success: false,
        errors: typeErrors.map(e => e.text),
      };
    }

    const assembly = program.compile();
    return {
      success: true,
      errors: [],
      assembly,
    };
  } catch (e: any) {
    const errorMsg = e.location
      ? `${e.location.filename}(${e.location.start.line}): ${e.message}`
      : e.message;
    return {
      success: false,
      errors: [errorMsg],
    };
  }
}

/**
 * Compile QLL to binary (with bare entrypoint).
 */
export function compileQLLToBinary(
  source: string,
  options: { includeAllocator?: boolean; filename?: string } = {}
): CompileResult {
  const compileResult = compileQLL(source, options);
  if (!compileResult.success || !compileResult.assembly) {
    return compileResult;
  }

  const entrypoint = getBareEntrypoint();
  const combined = AssemblyProgram.concat([entrypoint, compileResult.assembly]);
  const [messages, binaryProgram] = combined.assemble();

  if (!binaryProgram) {
    return {
      success: false,
      errors: messages.errors.map(e => e.text),
    };
  }

  return {
    success: true,
    errors: [],
    assembly: compileResult.assembly,
    binary: binaryProgram.encode(),
  };
}

/**
 * Compile and run QLL source, returning the exit code or error message.
 */
export async function runQLL(
  source: string,
  options: VMOptions & { includeAllocator?: boolean } = {}
): Promise<VMResult | string> {
  const result = compileQLLToBinary(source, {
    includeAllocator: options.includeAllocator,
  });

  if (!result.success || !result.binary) {
    return result.errors.join('\n');
  }

  const vm = new VM({
    debug: options.debug ?? true,
    cycles: options.cycles ?? 500,
    peripherals: options.peripherals,
  });

  return vm.run(result.binary);
}

/**
 * Run QLL and expect a specific numeric result.
 */
export function expectQLL(value: number, source: string, options: VMOptions & { includeAllocator?: boolean } = {}) {
  return expect(
    runQLL(source, options).then(n =>
      typeof n === 'string' ? n : Immediate.toString(n)
    )
  ).resolves.toBe(Immediate.toString(value));
}

/**
 * Run QLL expression and expect a specific result.
 */
export function expectExpr(expr: string, value: number) {
  return expectQLL(value, `
    function main(): byte {
      return <byte>(${expr});
    }
  `);
}

/**
 * Expect QLL compilation to fail with a specific error substring.
 */
export function expectCompileError(errorSubstring: string, source: string) {
  return expect(
    runQLL(source).then(n => {
      if (typeof n === 'string') {
        return n;
      }
      throw new Error('expected compile error, but program ran successfully');
    })
  ).resolves.toContain(errorSubstring);
}

// === Standard Library Loading ===

let cachedStdLib: LowLevelProgram | null = null;

/**
 * Load the full standard library with all bare-metal dependencies.
 */
export function getStdLib(): LowLevelProgram {
  if (!cachedStdLib) {
    const bareWaitText = fs.readFileSync(PATHS.bare.wait, 'utf-8');
    const bufferedText = fs.readFileSync(path.join(ROOT_DIR, 'shared', 'buffered.qll'), 'utf-8');
    const stdText = fs.readFileSync(PATHS.shared.std, 'utf-8');
    const allocText = fs.readFileSync(PATHS.shared.alloc, 'utf-8');
    const bareAllocText = fs.readFileSync(PATHS.bare.alloc, 'utf-8');
    const bareConsoleText = fs.readFileSync(path.join(ROOT_DIR, 'bare', 'console.qll'), 'utf-8');

    cachedStdLib = LowLevelProgram.concat([
      LowLevelProgram.parse(bareWaitText, 'bare/wait.qll'),
      LowLevelProgram.parse(bufferedText, 'shared/buffered.qll'),
      LowLevelProgram.parse(stdText, PATHS.shared.std),
      LowLevelProgram.parse(allocText, PATHS.shared.alloc),
      LowLevelProgram.parse(bareAllocText, PATHS.bare.alloc),
      LowLevelProgram.parse(bareConsoleText, 'bare/console.qll'),
    ]);
  }
  return cachedStdLib;
}

/**
 * Compile and run QLL with standard library included.
 */
export async function runQLLWithStd(
  source: string,
  options: VMOptions = {}
): Promise<VMResult | string> {
  try {
    const stdLib = getStdLib();
    const userProgram = LowLevelProgram.parse(source, 'test.qll');

    const program = LowLevelProgram.concat([stdLib, userProgram]);
    const typeErrors = program.typecheck().errors;

    if (typeErrors.length) {
      return typeErrors.map(e => e.text).join('\n');
    }

    const entrypoint = getBareEntrypoint();
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binaryProgram] = combined.assemble();

    if (!binaryProgram) {
      return messages.errors.map(e => e.text).join('\n');
    }

    const vm = new VM({
      debug: options.debug ?? true,
      cycles: options.cycles ?? 5000,
      peripherals: options.peripherals,
    });

    return vm.run(binaryProgram.encode());
  } catch (e: any) {
    return e.location
      ? `${e.location.filename}(${e.location.start.line}): ${e.message}`
      : e.message;
  }
}

/**
 * Run QLL with stdlib and expect a specific numeric result.
 */
export function expectQLLWithStd(value: number, source: string, options: VMOptions = {}) {
  return expect(
    runQLLWithStd(source, options).then(n =>
      typeof n === 'string' ? n : Immediate.toString(n)
    )
  ).resolves.toBe(Immediate.toString(value));
}

// === Assertion Helpers ===

/**
 * Assert that a value matches expected, with better error messages.
 */
export function assertEq<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    const msg = message ? `${message}: ` : '';
    throw new Error(`${msg}expected ${expected}, got ${actual}`);
  }
}

/**
 * Assert that a result is a successful numeric value.
 */
export function assertSuccess(result: VMResult | string): asserts result is number {
  if (typeof result === 'string') {
    throw new Error(`Expected success, got error: ${result}`);
  }
}
