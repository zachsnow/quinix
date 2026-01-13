/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */

import { LowLevelProgram } from './lowlevel/lowlevel';
import { VM } from './vm/vm';

// Bare-metal standard library for programs running directly on QVM.
// Uses memory-mapped I/O to communicate with debug peripherals.
const stdlib = `
namespace std {
  namespace console {
    function print(s: string): bool {
      var control: *byte = <unsafe * byte> 0x303;
      var buffer: string = <unsafe string> 0x304;
      return buffered::write(control, buffer, s);
    }

    function input(s: string): bool {
      var control = <unsafe * byte> 0x403;
      var buffer = <unsafe string> 0x404;
      return buffered::read(control, buffer, s);
    }
  }

  namespace buffered {
    .constant global READY: byte = 0x0;
    .constant global WRITE: byte = 0x1;
    .constant global READ: byte = 0x2;
    .constant global PENDING: byte = 0x3;
    .constant global ERROR: byte = 0x4;

    function write(control: * byte, buffer: string, data: string): bool {
      len buffer = len data;
      for(var i = 0; i < len data; i = i + 1){
        buffer[i] = data[i];
      }

      *control = WRITE;

      while(*control == PENDING){}

      return *control == READY;
    }

    function read(control: * byte, buffer: string, data: string): bool {
      *control = READ;

      while(*control == PENDING){}
      if(*control != READY){
        return false;
      }

      len data = len buffer;
      for(var i = 0; i < len buffer; i = i + 1){
        data[i] = buffer[i];
      }
      return true;
    }
  }
}
`;

// Export to globalThis for browser use
declare const globalThis: Record<string, unknown>;

if (typeof globalThis !== 'undefined') {
  globalThis.LowLevelProgram = LowLevelProgram;
  globalThis.VM = VM;
  globalThis.stdlib = stdlib;
}

export { LowLevelProgram, VM, stdlib };
