/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */

import { LowLevelProgram } from './lowlevel/lowlevel';
import { VM } from './vm/vm';
import { DebugOutputPeripheral } from './vm/peripherals';

// Import the bare-metal standard library from the source file.
// This is embedded at build time by bun.
import stdlib from '../lib/std.bare.qll' with { type: 'text' };

type BrowserVMOptions = {
  cycles?: number;
  onOutput?: (s: string) => void;
};

/**
 * Creates a VM configured for browser use.
 * Only includes the debug output peripheral to avoid Node.js dependencies.
 * Output from std::console::print will be sent to the onOutput callback.
 */
function createBrowserVM(options?: BrowserVMOptions): VM {
  const outputPeripheral = new DebugOutputPeripheral();
  if (options?.onOutput) {
    outputPeripheral.onOutput = options.onOutput;
  }

  return new VM({
    cycles: options?.cycles,
    peripherals: [outputPeripheral],
  });
}

// Export to globalThis for browser use
declare const globalThis: Record<string, unknown>;

if (typeof globalThis !== 'undefined') {
  globalThis.LowLevelProgram = LowLevelProgram;
  globalThis.VM = VM;
  globalThis.DebugOutputPeripheral = DebugOutputPeripheral;
  globalThis.createBrowserVM = createBrowserVM;
  globalThis.stdlib = stdlib;
}

export { LowLevelProgram, VM, DebugOutputPeripheral, createBrowserVM, stdlib };
