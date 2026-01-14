/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { VM } from '@/vm/vm';

// Import the bare-metal standard library from the source file.
// This is embedded at build time by bun.
import stdlib from '@/../lib/std.bare.qll' with { type: 'text' };
import { BrowserInputPeripheral, BrowserOutputPeripheral } from './peripherals';

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

export {
  BrowserInputPeripheral, BrowserOutputPeripheral, createBrowserVM, LowLevelProgram, stdlib, VM
};

