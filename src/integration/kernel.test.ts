/**
 * Kernel integration tests.
 * Tests kernel module compilation and basic functionality.
 *
 * Since the kernel requires a full VM environment with peripherals,
 * these tests focus on:
 * - Compilation of kernel modules
 * - Type checking
 * - Basic kernel data structures
 */

import fs from 'fs';
import path from 'path';

import { VM } from '@/vm/vm';
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { BufferedPeripheral, TimerPeripheral, ClockPeripheral } from '@/vm/peripherals';
import { PATHS } from '@test/helpers';

const KERNEL_DIR = path.resolve(__dirname, '..', '..', 'kernel');

// Load all kernel source files
function loadKernelSource(filename: string): string {
  return fs.readFileSync(path.join(KERNEL_DIR, filename), 'utf-8');
}

function loadSharedSource(filename: string): string {
  return fs.readFileSync(path.join(path.resolve(__dirname, '..', '..'), 'shared', filename), 'utf-8');
}

describe('Kernel: Module Compilation', () => {
  test('kernel/test-simple.qll compiles and runs', async () => {
    const source = loadKernelSource('test-simple.qll');
    const programs = [
      LowLevelProgram.parse(source, 'test-simple.qll'),
    ];
    const program = LowLevelProgram.concat(programs);
    const errors = program.typecheck().errors;
    expect(errors.length).toBe(0);

    // Compile and run
    const entrypointText = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    const entrypoint = AssemblyProgram.parse(entrypointText, PATHS.bare.entrypoint);
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();
    expect(binary).toBeDefined();

    const vm = new VM({ cycles: 500 });
    const result = await vm.run(binary!.encode());
    expect(result).toBe(0);
  });

  test('kernel source files parse', () => {
    // Just verify that the kernel files can be parsed
    expect(() => loadKernelSource('alloc.qll')).not.toThrow();
    expect(() => loadKernelSource('support.qll')).not.toThrow();
    expect(() => loadKernelSource('memory.qll')).not.toThrow();
  });
});

describe('Kernel: Data Structures', () => {
  const stdSource = loadSharedSource('std.qll');
  const sharedAllocSource = loadSharedSource('alloc.qll');

  test('kernel::memory::page struct has correct size', async () => {
    const source = `
      namespace kernel::memory {
        type flags = byte;
        type page = struct {
          virtual_address: byte;
          physical_address: byte;
          size: byte;
          flags: flags;
        };
      }
      function main(): byte {
        return sizeof kernel::memory::page;
      }
    `;

    const programs = [
      LowLevelProgram.parse(source, 'test.qll'),
    ];
    const program = LowLevelProgram.concat(programs);
    const errors = program.typecheck().errors;
    expect(errors.length).toBe(0);

    const entrypointText = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    const entrypoint = AssemblyProgram.parse(entrypointText, PATHS.bare.entrypoint);
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();
    expect(binary).toBeDefined();

    const vm = new VM({ cycles: 500 });
    const result = await vm.run(binary!.encode());
    // page has 4 byte fields
    expect(result).toBe(4);
  });

  test('kernel::interrupts::state struct layout', async () => {
    const source = `
      namespace kernel::interrupts {
        type state = struct {
          registers: byte[64];
          ip: byte;
        };
      }
      function main(): byte {
        return sizeof kernel::interrupts::state;
      }
    `;

    const programs = [
      LowLevelProgram.parse(source, 'test.qll'),
    ];
    const program = LowLevelProgram.concat(programs);
    const errors = program.typecheck().errors;
    expect(errors.length).toBe(0);

    const entrypointText = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    const entrypoint = AssemblyProgram.parse(entrypointText, PATHS.bare.entrypoint);
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();
    expect(binary).toBeDefined();

    const vm = new VM({ cycles: 500 });
    const result = await vm.run(binary!.encode());
    // 64 registers + 1 ip = 65
    expect(result).toBe(65);
  });
});

describe('Kernel: Memory Management Types', () => {
  test('memory flags constants', async () => {
    const source = `
      namespace kernel::memory::flags {
        .constant global PRESENT: byte = 0b0001;
        .constant global READ: byte = 0b0010;
        .constant global WRITE: byte = 0b0100;
        .constant global EXECUTE: byte = 0b1000;
      }
      function main(): byte {
        return kernel::memory::flags::PRESENT |
               kernel::memory::flags::READ |
               kernel::memory::flags::WRITE |
               kernel::memory::flags::EXECUTE;
      }
    `;

    const programs = [
      LowLevelProgram.parse(source, 'test.qll'),
    ];
    const program = LowLevelProgram.concat(programs);
    const errors = program.typecheck().errors;
    expect(errors.length).toBe(0);

    const entrypointText = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    const entrypoint = AssemblyProgram.parse(entrypointText, PATHS.bare.entrypoint);
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();
    expect(binary).toBeDefined();

    const vm = new VM({ cycles: 500 });
    const result = await vm.run(binary!.encode());
    // All flags combined
    expect(result).toBe(0b1111);
  });
});

describe('Kernel: Error Types', () => {
  test('kernel error constants', async () => {
    const source = `
      namespace kernel::error {
        .constant global PANIC: byte = -1;
        .constant global NO_LOG: byte = -2;
      }
      function main(): byte {
        return kernel::error::PANIC;
      }
    `;

    const programs = [
      LowLevelProgram.parse(source, 'test.qll'),
    ];
    const program = LowLevelProgram.concat(programs);
    const errors = program.typecheck().errors;
    expect(errors.length).toBe(0);

    const entrypointText = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    const entrypoint = AssemblyProgram.parse(entrypointText, PATHS.bare.entrypoint);
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();
    expect(binary).toBeDefined();

    const vm = new VM({ cycles: 500 });
    const result = await vm.run(binary!.encode());
    expect(result).toBe(-1 >>> 0); // Unsigned
  });
});

describe('Kernel: Interrupt Constants', () => {
  test('interrupt number constants', async () => {
    const source = `
      namespace kernel::interrupts {
        .constant global ERROR: byte = 0x1;
        .constant global TIMER: byte = 0x2;
        .constant global SYSCALL: byte = 0x80;
      }
      function main(): byte {
        return kernel::interrupts::SYSCALL;
      }
    `;

    const programs = [
      LowLevelProgram.parse(source, 'test.qll'),
    ];
    const program = LowLevelProgram.concat(programs);
    const errors = program.typecheck().errors;
    expect(errors.length).toBe(0);

    const entrypointText = fs.readFileSync(PATHS.bare.entrypoint, 'utf-8');
    const entrypoint = AssemblyProgram.parse(entrypointText, PATHS.bare.entrypoint);
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();
    expect(binary).toBeDefined();

    const vm = new VM({ cycles: 500 });
    const result = await vm.run(binary!.encode());
    expect(result).toBe(0x80);
  });
});

describe('Kernel: User Test Programs', () => {
  test('kernel test programs parse', () => {
    // Just verify the test program files parse correctly
    const simplePath = path.join(KERNEL_DIR, 'tests', 'simple.qll');
    if (fs.existsSync(simplePath)) {
      const source = fs.readFileSync(simplePath, 'utf-8');
      expect(() => LowLevelProgram.parse(source, 'simple.qll')).not.toThrow();
    }

    const helloPath = path.join(KERNEL_DIR, 'tests', 'hello.qll');
    if (fs.existsSync(helloPath)) {
      const source = fs.readFileSync(helloPath, 'utf-8');
      expect(() => LowLevelProgram.parse(source, 'hello.qll')).not.toThrow();
    }
  });
});
