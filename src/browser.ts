/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */

import { LowLevelProgram } from './lowlevel/lowlevel';
import { VM } from './vm/vm';

// Import the bare-metal standard library from the source file.
// This is embedded at build time by bun.
import stdlib from '../lib/std.bare.qll' with { type: 'text' };

// Export to globalThis for browser use
declare const globalThis: Record<string, unknown>;

if (typeof globalThis !== 'undefined') {
  globalThis.LowLevelProgram = LowLevelProgram;
  globalThis.VM = VM;
  globalThis.stdlib = stdlib;
}

export { LowLevelProgram, VM, stdlib };
