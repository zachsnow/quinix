/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { VM } from '@/vm/vm';

// Import the bare-metal standard library components.
// These are embedded at build time by bun and concatenated.
import sharedStd from '@/../shared/std.qll' with { type: 'text' };
import sharedBuffered from '@/../shared/buffered.qll' with { type: 'text' };
import sharedAlloc from '@/../shared/alloc.qll' with { type: 'text' };
import bareConsole from '@/../bare/console.qll' with { type: 'text' };
import bareAlloc from '@/../bare/alloc.qll' with { type: 'text' };

const stdlib = [sharedStd, sharedBuffered, sharedAlloc, bareConsole, bareAlloc].join('\n');
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

