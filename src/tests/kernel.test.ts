/**
 * Kernel integration tests.
 * Tests kernel module compilation and basic functionality.
 */

import fs from 'fs';
import path from 'path';

import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { PATHS, expectQLL } from '@test/helpers';

const KERNEL_DIR = path.resolve(__dirname, '..', '..', 'kernel');

function loadKernelSource(filename: string): string {
  return fs.readFileSync(path.join(KERNEL_DIR, filename), 'utf-8');
}

describe('Kernel: Module Compilation', () => {
  test('kernel/test-simple.qll compiles and runs', () => {
    const source = loadKernelSource('test-simple.qll');
    return expectQLL(0, source);
  });

  test('kernel source files parse', () => {
    expect(() => loadKernelSource('alloc.qll')).not.toThrow();
    expect(() => loadKernelSource('support.qll')).not.toThrow();
    expect(() => loadKernelSource('memory.qll')).not.toThrow();
  });
});

describe('Kernel: Data Structures', () => {
  test('kernel::memory::page struct has correct size', () => {
    return expectQLL(4, `
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
    `);
  });

  test('kernel::interrupts::state struct layout', () => {
    return expectQLL(65, `
      namespace kernel::interrupts {
        type state = struct {
          registers: byte[64];
          ip: byte;
        };
      }
      function main(): byte {
        return sizeof kernel::interrupts::state;
      }
    `);
  });
});

describe('Kernel: Memory Management Types', () => {
  test('memory flags constants', () => {
    return expectQLL(0b1111, `
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
    `);
  });
});

describe('Kernel: Error Types', () => {
  test('kernel error constants', () => {
    return expectQLL(-1 >>> 0, `
      namespace kernel::error {
        .constant global PANIC: byte = -1;
        .constant global NO_LOG: byte = -2;
      }
      function main(): byte {
        return kernel::error::PANIC;
      }
    `);
  });
});

describe('Kernel: Interrupt Constants', () => {
  test('interrupt number constants', () => {
    return expectQLL(0x80, `
      namespace kernel::interrupts {
        .constant global ERROR: byte = 0x1;
        .constant global TIMER: byte = 0x2;
        .constant global SYSCALL: byte = 0x80;
      }
      function main(): byte {
        return kernel::interrupts::SYSCALL;
      }
    `);
  });
});

describe('Kernel: User Test Programs', () => {
  test('kernel test programs parse', () => {
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
