import { stringToCodePoints, ResolvablePromise, codePointsToString, release } from '@/lib/util';
import { logger } from '@/lib/logger';
import { VM } from '@/vm/vm';
import type { Interrupt } from '@/vm/vm';
import { Address } from '@/lib/types';
import { Instruction, Operation, Register, Immediate } from '@/vm/instructions';
import { Peripheral, BufferedPeripheral } from '@/vm/peripherals';
import type { PeripheralMapping } from '@/vm/peripherals';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const log = logger('vm:peripherals');


/**
 * A peripheral to write zero-terminated unicode strings to stdout.
 */
class DebugOutputPeripheral extends BufferedPeripheral {
  public readonly name = "debug-output";
  public readonly identifier = 0x00000003;

  public async onWrite(data: number[]): Promise<void> {
    // Release for "realism".
    await release();

    const s = codePointsToString(data);
    process.stdout.write(s);
  }
}

/**
 * A peripheral to read newline-terminated strings from stdin.
 * Ideally we'll replace this with a keyboard peripheral and a
 * kernel library.
 */
class DebugInputPeripheral extends BufferedPeripheral {
  public readonly name = "debug-input";
  public readonly identifier = 0x00000004;

  private resolvablePromise?: ResolvablePromise<number[]>;

  private buffer: number[] = [];

  public constructor() {
    super();
    this.listener = this.listener.bind(this);
  }

  public unmap() {
    super.unmap();
    process.stdin.off('data', this.listener);
    process.stdin.off('end', this.listener);
  }

  protected onRead(): Promise<number[]> {
    if (this.resolvablePromise) {
      this.resolvablePromise.reject('read while pending');
    }

    this.resolvablePromise = new ResolvablePromise<number[]>();
    process.stdin.on('data', this.listener);
    process.stdin.on('end', this.listener);
    return this.resolvablePromise.promise;
  }

  private listener(data?: Buffer) {
    if (!this.mapping || !this.resolvablePromise) {
      this.unmapped();
    }

    // End.
    if (data === undefined) {
      this.resolvablePromise.reject('end of input');
      return;
    }

    // Data.
    const text = data.toString("utf8");
    const i = text.indexOf('\n');
    if (i === -1) {
      log.debug(`${this.name}: no newline, bufferring...`);
      this.buffer.push(...stringToCodePoints(text));
      return;
    }

    const left = text.substr(0, i);
    const right = text.substr(i + 1);

    this.buffer.push(...stringToCodePoints(left));
    const buffer = this.buffer;
    this.buffer = stringToCodePoints(right);

    log.debug(`${this.name}: newline, resolving`, buffer);

    this.resolvablePromise.resolve(buffer);

    process.stdin.off('data', this.listener);
    process.stdin.off('end', this.listener);
  }
}

/**
 * A peripheral to trigger a `debugger;` statement.
 *
 * It also maps an interrupt handler to automatically write
 * to the control io byte (and thereby trigger the `debugger;`
 * statement). The idea is that we could allow client programs
 * to trigger the debugger by overwriting instructions with `int 0x3`,
 * as in x86.
 */
class DebugBreakPeripheral extends Peripheral {
  public readonly name = "debug-break";
  public readonly identifier = 0x00000002;

  public readonly io = 0x01;
  public readonly shared = 0x0;
  public readonly interrupt: Interrupt = 0x3;

  private readonly CONTROL_ADDR = 0x0;

  private readonly COMPLETE = 0x0;
  private readonly BREAK = 0x1;
  private readonly PENDING = 0x2;
  private readonly ERROR = 0x3;

  public notify(address: Address): void {
    if (!this.mapping) {
      this.unmapped();
    }

    // Verify we are attempting to write.
    const control = this.mapping.view[this.CONTROL_ADDR];
    if (control !== this.BREAK) {
      log.debug(`${this.name}: invalid control ${Immediate.toString(control)}`);
      this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
      return;
    }

    // Mark pending.
    this.mapping.view[this.CONTROL_ADDR] = this.PENDING;

    debugger; // DebugBreakPeripheral: Break!

    // Make this non-blocking for "realism".
    setTimeout(() => {
      if (!this.mapping) {
        this.unmapped();
      }
      this.mapping.view[this.CONTROL_ADDR] = this.COMPLETE;
    });
  }

  public get interruptHandler(): Instruction[] {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    // Map a handler that simply triggers a break; that way programs
    // can use `int 0x3` to trigger the debugger.
    return [
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(this.mapping.base + this.CONTROL_ADDR),
      Instruction.createOperation(Operation.CONSTANT, Register.R1),
      Instruction.createImmediate(0x1),
      Instruction.createOperation(Operation.STORE, Register.R0, Register.R1),

      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(0x0),
      Instruction.createOperation(Operation.INT, undefined, Register.R0),
    ];
  }
}

/**
 * Listens for keypresses and triggers int 0x10.
 *
 * @remarks this will hang listening on stdin (even with `off()`) so it shouldn't
 * be included in the test suite for now. Only works in Node.js environments.
 */
class KeypressPeripheral extends Peripheral {
  public readonly name = 'keypress';
  public readonly identifier = 0x00000010;

  public readonly interrupt: Interrupt = 0x10;

  public readonly io = 0x0;
  public readonly shared = 0x2;

  private initialized = false;

  public constructor() {
    super();

    // Bind for easier listener removal.
    this.onKeypress = this.onKeypress.bind(this);
  }

  private initReadline() {
    if (this.initialized) {
      return;
    }
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode instanceof Function) {
      process.stdin.setRawMode(true);
    }
    this.initialized = true;
  }

  public notify(address: Address) { }

  public map(vm: VM, mapping: PeripheralMapping) {
    super.map(vm, mapping);
    this.initReadline();
    process.stdin.on('keypress', this.onKeypress);
  }

  public unmap() {
    super.unmap();
    process.stdin.off('keypress', this.onKeypress);
  }

  private onKeypress(data: string, key: { name: string }) {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    const c = key.name.codePointAt(0);
    if (c !== undefined) {
      this.mapping.view[this.mapping.base] = c;
      this.vm.interrupt(this.interrupt);
    }
  }
}

/**
 * A simple peripheral for reading files from the host file system.
 * Paths are resolved relative to the base directory (typically the binary's directory).
 */
class DebugFilePeripheral extends BufferedPeripheral {
  public readonly name = 'debug-file';
  public readonly identifier = 0x00000011;

  private baseDir: string;
  private path: string = '';

  public constructor(baseDir: string = '.') {
    super();
    this.baseDir = baseDir;
  }

  protected async onWrite(data: number[]): Promise<void> {
    if (!this.path) {
      this.path = codePointsToString(data);
      return;
    }

    log.debug(`${this.name}: writing path ${this.path}`);
    await fs.promises.writeFile(this.path, codePointsToString(data), 'utf-8');
    log.debug(`${this.name}: write complete`);
  }

  protected async onRead(): Promise<number[]> {
    if (!this.path) {
      throw new Error('no path');
    }
    const relativePath = this.path;
    this.path = '';  // Clear path so next write sets a new path
    const fullPath = path.resolve(this.baseDir, relativePath);
    log.debug(`${this.name}: reading path ${fullPath}`);

    // Check if this is a binary file (e.g., .qbin extension or no extension)
    const isBinary = !fullPath.includes('.') ||
                     fullPath.endsWith('.qbin') ||
                     fullPath.endsWith('.bin');

    if (isBinary) {
      // Read as binary - each 4 bytes becomes a 32-bit word
      const buffer = await fs.promises.readFile(fullPath);
      const words: number[] = [];
      for (let i = 0; i + 3 < buffer.length; i += 4) {
        // Little-endian 32-bit integer
        const word = buffer[i] | (buffer[i + 1] << 8) | (buffer[i + 2] << 16) | (buffer[i + 3] << 24);
        words.push(word >>> 0); // Convert to unsigned
      }
      log.debug(`${this.name}: read ${words.length} words from binary file`);
      return words;
    }

    // Read as text
    const text = await fs.promises.readFile(fullPath, 'utf-8');
    log.debug(`${this.name}: read complete`);
    return stringToCodePoints(text);
  }
}

export {
  DebugBreakPeripheral,
  DebugOutputPeripheral,
  DebugInputPeripheral,
  DebugFilePeripheral,
  KeypressPeripheral,
};
