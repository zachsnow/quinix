/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { VM, VMResult } from '@/vm/vm';
import { AssemblyProgram } from '@/assembly/assembly';

// Import the bare-metal standard library components.
// These are embedded at build time by bun and concatenated.
import sharedStd from '@/../shared/std.qll' with { type: 'text' };
import sharedBuffered from '@/../shared/buffered.qll' with { type: 'text' };
import sharedAlloc from '@/../shared/alloc.qll' with { type: 'text' };
import bareConsole from '@/../bare/console.qll' with { type: 'text' };
import bareAlloc from '@/../bare/alloc.qll' with { type: 'text' };
import entrypoint from '@/../bare/entrypoint.qasm' with { type: 'text' };

const stdlib = [sharedStd, sharedBuffered, sharedAlloc, bareConsole, bareAlloc].join('\n');
import { BrowserInputPeripheral, BrowserOutputPeripheral, createCanvasRenderer } from './peripherals';
import { DisplayPeripheral } from '@/vm/peripherals';

type BrowserVMOptions = {
  cycles?: number;
  outputSelector?: string;
  inputContainerSelector?: string;
};

/**
 * Creates a VM configured for browser use.
 * Includes browser-specific input and output peripherals.
 */
function createBrowserVM(options?: BrowserVMOptions): VM {

  return new VM({
    cycles: options?.cycles,
    peripherals: [
      new BrowserOutputPeripheral(options?.outputSelector),
      new BrowserInputPeripheral(options?.inputContainerSelector),
    ],
  });
}

type CompileResult = {
  success: boolean;
  errors: string[];
  warnings: string[];
  assembly?: string;
  binary?: Uint32Array;
};

/**
 * Compiles QLL code to assembly and binary.
 * @param code The QLL source code
 * @param options.includeStdlib Whether to include the standard library (default: false)
 * @returns Compilation result with assembly text and binary
 */
function compile(code: string, options?: { includeStdlib?: boolean }): CompileResult {
  try {
    // Parse QLL code
    const sources = options?.includeStdlib ? [stdlib, code] : [code];
    const programs = sources.map((source, i) => {
      return LowLevelProgram.parse(source, i === 0 && options?.includeStdlib ? 'stdlib.qll' : 'input.qll');
    });
    const program = LowLevelProgram.concat(programs);

    // Typecheck
    const typeResult = program.typecheck();
    if (typeResult.errors.length > 0) {
      return {
        success: false,
        errors: typeResult.errors.map(e => e.toString()),
        warnings: typeResult.warnings.map(w => w.toString()),
      };
    }

    // Compile to assembly
    const compiledAssembly = program.compile();

    // Parse and concat the entrypoint
    const entrypointAssembly = AssemblyProgram.parse(entrypoint, 'entrypoint.qasm');
    const fullAssembly = AssemblyProgram.concat([entrypointAssembly, compiledAssembly]);

    // Assemble to binary
    const [assembleMessages, binary] = fullAssembly.assemble();
    if (assembleMessages.errors.length > 0) {
      return {
        success: false,
        errors: assembleMessages.errors.map(e => e.toString()),
        warnings: typeResult.warnings.map(w => w.toString()),
        assembly: fullAssembly.toString(),
      };
    }

    return {
      success: true,
      errors: [],
      warnings: typeResult.warnings.map(w => w.toString()),
      assembly: fullAssembly.toString(),
      binary: binary!.encode(),
    };
  } catch (e: any) {
    return {
      success: false,
      errors: [e.message],
      warnings: [],
    };
  }
}

type RunResult = {
  success: boolean;
  errors: string[];
  warnings: string[];
  assembly?: string;
  result?: VMResult;
};

/**
 * Compiles and runs QLL code.
 * @param code The QLL source code
 * @param options.includeStdlib Whether to include the standard library (default: false)
 * @param options.cycles Maximum cycles to run (default: 100000)
 * @returns Run result with assembly and VM result
 */
async function compileAndRun(code: string, options?: { includeStdlib?: boolean; cycles?: number }): Promise<RunResult> {
  const compileResult = compile(code, options);
  if (!compileResult.success || !compileResult.binary) {
    return {
      success: false,
      errors: compileResult.errors,
      warnings: compileResult.warnings,
      assembly: compileResult.assembly,
    };
  }

  try {
    const vm = new VM({ cycles: options?.cycles ?? 100000 });
    const result = await vm.run(compileResult.binary);
    return {
      success: true,
      errors: [],
      warnings: compileResult.warnings,
      assembly: compileResult.assembly,
      result,
    };
  } catch (e: any) {
    return {
      success: false,
      errors: [e.message],
      warnings: compileResult.warnings,
      assembly: compileResult.assembly,
    };
  }
}

export {
  AssemblyProgram,
  BrowserInputPeripheral,
  BrowserOutputPeripheral,
  compile,
  compileAndRun,
  createBrowserVM,
  createCanvasRenderer,
  DisplayPeripheral,
  entrypoint,
  LowLevelProgram,
  stdlib,
  VM,
};

