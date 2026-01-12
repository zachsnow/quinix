/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */

import { LowLevelProgram } from './lowlevel/lowlevel';
import { VM } from './vm/vm';

// Export to globalThis for browser use
declare const globalThis: Record<string, unknown>;

if (typeof globalThis !== 'undefined') {
  globalThis.LowLevelProgram = LowLevelProgram;
  globalThis.VM = VM;
}

export { LowLevelProgram, VM };
