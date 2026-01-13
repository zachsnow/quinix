import { stringToCodePoints, ResolvablePromise, codePointsToString, release } from '../lib/util';
import { logger } from '../lib/logger';
import { VM } from './vm';
import type { Interrupt } from './vm';
import { Memory, Address, Offset } from '../lib/base-types';
import { Instruction, Operation, Register, Immediate } from './instructions';
import fs from 'fs';

const log = logger('vm:peripherals');

abstract class Peripheral {
  /**
   * The peripheral's display name.
   */
  public abstract readonly name: string;

  /**
   * The peripheral's unique identifier. No two loaded
   * peripherals should share an identifier.
   */
  public abstract readonly identifier: Immediate;

  /**
   * The number of bytes to map for IO.
   */
  public abstract readonly io: Offset;

  /**
   * The number of bytes to map for shared use.
   */
  public readonly shared: Offset = 0;

  protected vm?: VM;
  protected mapping?: PeripheralMapping;

  protected unmapped(): never {
    const message = `unmapped peripheral ${this.name}`;
    if(this.vm){
      this.vm.fault(message);
    }
    throw new Error(message);
  }

  /**
   * Called by the VM after the peripheral has been mapped.
   *
   * @param vm the VM to which this peripheral is mapped
   * @param view the view of the VM's memory to which this peripheral is mapped
   */
  public map(vm: VM, mapping: PeripheralMapping): void {
    this.vm = vm;
    this.mapping = mapping;
  }

  /**
   * Called by the VM after the peripheral has been unmapped.
   */
  public unmap(): void {}

  /**
   * Notifies the peripheral of a write to its "io" memory.
   *
   * @param address the address in the view that was written.
   */
  public abstract notify(address: Address): void;

  /**
   * The interrupt that this peripheral will use to communicate
   * with the VM; `0x0` means that the peripheral does not need
   * to map an interrupt.
   */
  public interrupt: Interrupt = 0x0;

  /**
   * The peripheral's interrupt handler.
   */
  public get interruptHandler(): Instruction[] {
    return [];
  }
}

type PeripheralMapping = {
  peripheral: Peripheral,
  base: Address,
  view: Memory,
};

/**
 * A peripheral implementing a "hardware" timer.
 */
class TimerPeripheral extends Peripheral {
  public readonly name = 'timer';
  public readonly identifier = 0x00000001;

  public readonly io = 0x1;
  public readonly shared = 0x0;
  public readonly interrupt = 0x2;

  public readonly TIME_ADDR = 0x0;

  private milliseconds = 0;
  private interval?: NodeJS.Timeout;

  public unmap(){
    if(this.interval){
      log.debug(`${this.name}: unmapping and clearing interval`);
      clearInterval(this.interval);
    }
  }

  public notify(address: Address): void {
    if(!this.mapping){
      this.unmapped();
    }

    // Don't do anything if we are already running at this interval.
    const milliseconds = this.mapping.view[0];
    if(this.milliseconds === milliseconds){
      return;
    }
    this.milliseconds = milliseconds;

    // Clear current interval.
    if(this.interval){
      log.debug(`${this.name}: clearing interval`);
      clearInterval(this.interval);
      this.interval = undefined;
    }

    // Allow disabling the timer entirely.
    if(this.milliseconds){
      log.debug(`${this.name}: configuring interval ${this.milliseconds}`);
      this.interval = setInterval(() => {
        this.intervalHandler();
      }, this.milliseconds);
    }
  }

  private intervalHandler(){
    if(!this.vm){
      this.unmapped();
    }
    log.debug(`${this.name}: interrupting`);
    this.vm.interrupt(this.interrupt);
  }
}

abstract class BufferedPeripheral extends Peripheral {
  public readonly io = 0x1;
  public readonly shared: Offset;

  protected readonly CONTROL_ADDR = 0x0;
  private readonly CAPACITY_ADDR = 0x1;
  private readonly SIZE_ADDR = 0x2;
  private readonly BUFFER_ADDR = 0x3;

  private readonly DEFAULT_BUFFER_SIZE = 0x100 - this.BUFFER_ADDR;

  private readonly READY = 0x0;
  private readonly WRITE = 0x1;
  private readonly READ = 0x2;
  private readonly PENDING = 0x3;
  private readonly ERROR = 0xffffffff;

  private readonly bufferSize: number;

  private inputBuffer?: number[];
  private outputBuffer: number[] = [];

  public constructor(bufferSize?: Offset){
    super();

    this.bufferSize = bufferSize ?? this.DEFAULT_BUFFER_SIZE;
    this.shared = 0x2 + this.bufferSize;
  }

  public map(vm: VM, mapping: PeripheralMapping): void {
    super.map(vm, mapping);

    if(!this.mapping){
      this.unmapped();
    }

    this.mapping.view[this.CAPACITY_ADDR] = this.bufferSize;
    this.mapping.view[this.SIZE_ADDR] = 0x0;
  }

  public notify(address: Address): void {
    if(!this.mapping){
      this.unmapped();
    }

    const control = this.mapping.view[this.CONTROL_ADDR];

    log.debug(`${this.name}: notified buffered peripheral: ${Immediate.toString(control, 1)}`);

    if(control === this.WRITE){
      this.mapping.view[this.CONTROL_ADDR] = this.PENDING;
      const isComplete = this.readShared();
      if(!isComplete){
        this.ready();
        return;
      }
      const outputBuffer = this.outputBuffer;
      this.outputBuffer = [];
      this.onWrite(outputBuffer).then(() => {
        this.ready();
      }).catch((e) => {
        this.error(e);
      });
      return;
    }

    if(control === this.READ){
      this.mapping.view[this.CONTROL_ADDR] = this.PENDING;
      if(this.inputBuffer){
        this.writeShared();
        this.ready();
        return;
      }
      this.onRead().then((data) => {
        this.inputBuffer = data;
        this.writeShared();
        this.ready();
      }).catch((e) => {
        this.error(e);
      });
      return;
    }

    this.error(`unsupported operation ${Immediate.toString(control)}`);
  }

  /**
   * Called when the client program triggers a `WRITE` control.
   * Derived classes implementing output peripherals should implement
   * this.
   *
   * @param data the data that was written by the client program
   * to the shared buffer.
   */
  protected async onWrite(data: number[]): Promise<void> {
    return Promise.reject('write not supported');
  }

  /**
   * Called when the client program triggers a `READ` control.
   * Derived classes implementing input peripherals should implement
   * this.
   *
   * @returns a promise that resolves to the data that should
   * be returned to the client program.
   */
  protected async onRead(): Promise<number[]> {
    return Promise.reject('read not supported.')
  }

  /**
   * Returns the data in the buffer. Supports buffered writes by the
   * client, where the client writes a size value larger than the actual
   * buffer, triggers `WRITE` with a full buffer, and repeats with
   * smaller sizes until a write fits within the buffer.
   *
   * @returns whether the client program has finished writing to
   * the shared memory.
   */
  private readShared(): boolean {
    if(!this.mapping){
      this.unmapped();
    }

    // Get shared data.
    const sourceSize = this.mapping.view[this.SIZE_ADDR];
    const size = Math.min(sourceSize, this.bufferSize);
    for(var i = 0; i < size; i++){
      this.outputBuffer.push(this.mapping.view[this.BUFFER_ADDR + i]);
    }

    return sourceSize <= this.bufferSize;
  }

  /**
   * Writes data to the shared buffer. Supports buffered reads
   * by the client, where the client reads a buffer, sees that
   * the peripheral has indicated it has more than a full buffer
   * of data, and continues to call read until it reads a size
   * that fits within the buffer.
   *
   * @returns whether the client has consumed the entire
   * input buffer.
   */
  protected writeShared(): boolean {
    if(!this.mapping){
      this.unmapped();
    }
    if(!this.inputBuffer){
      throw new Error();
    }

    const dataSize = this.inputBuffer.length;
    const size = Math.min(this.bufferSize, dataSize);

    this.mapping.view[this.SIZE_ADDR] = size;

    for(var i = 0; i < size; i++){
      this.mapping.view[this.BUFFER_ADDR + i] = this.inputBuffer[i];
    }
    this.inputBuffer.splice(0, size);

    if(dataSize <= this.bufferSize){
      this.inputBuffer = undefined;
    }
    return !!this.inputBuffer;
  }

  /**
   * Mark the peripheral as ready.
   *
   * @param message optional message to log.
   */
  protected ready(message: string = 'complete'){
    log.debug(`${this.name}: ${message}`);
    if(!this.mapping){
      this.unmapped();
    }
    this.mapping.view[this.CONTROL_ADDR] = this.READY;
  }

  /**
   * Mark the peripheral as in an error state.
   *
   * @param message optional error to log.
   */
  protected error(message: string = 'error'){
    log.debug(`${this.name}: ${message}`);
    if(!this.mapping){
      this.unmapped();
    }
    this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
  }
}

/**
 * A peripheral to write zero-terminated unicode strings to stdout.
 */
class DebugOutputPeripheral extends BufferedPeripheral {
  public readonly name = "debug-output";
  public readonly identifier = 0x00000003;

  // Optional callback for output (used in browser environments).
  public onOutput?: (s: string) => void;

  public async onWrite(data: number[]): Promise<void> {
    // Release for "realism".
    await release();

    const s = codePointsToString(data);
    if (this.onOutput) {
      this.onOutput(s);
    } else if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(s);
    } else {
      console.log(s);
    }
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

  public constructor(){
    super();
    this.listener = this.listener.bind(this);
  }

  public unmap(){
    super.unmap();
    process.stdin.off('data', this.listener);
    process.stdin.off('end', this.listener);
  }

  protected onRead(): Promise<number[]> {
    if(this.resolvablePromise){
      this.resolvablePromise.reject('read while pending');
    }

    this.resolvablePromise = new ResolvablePromise<number[]>();
    process.stdin.on('data', this.listener);
    process.stdin.on('end', this.listener);
    return this.resolvablePromise.promise;
  }

  private listener(data?: Buffer){
    if(!this.mapping || !this.resolvablePromise){
      this.unmapped();
    }

    // End.
    if(data === undefined){
      this.resolvablePromise.reject('end of input');
      return;
    }

    // Data.
    const text = data.toString("utf8");
    const i = text.indexOf('\n');
    if(i === -1){
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
    if(!this.mapping){
      this.unmapped();
    }

    // Verify we are attempting to write.
    const control = this.mapping.view[this.CONTROL_ADDR];
    if(control !== this.BREAK){
      log.debug(`${this.name}: invalid control ${Immediate.toString(control)}`);
      this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
      return;
    }

    // Mark pending.
    this.mapping.view[this.CONTROL_ADDR] = this.PENDING;

    debugger; // DebugBreakPeripheral: Break!

    // Make this non-blocking for "realism".
    setTimeout(() => {
      if(!this.mapping){
        this.unmapped();
      }
      this.mapping.view[this.CONTROL_ADDR] = this.COMPLETE;
    });
  }

  public get interruptHandler(): Instruction[] {
    if(!this.mapping || !this.vm){
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

  public constructor(){
    super();

    // Bind for easier listener removal.
    this.onKeypress = this.onKeypress.bind(this);
  }

  // Dynamically import readline to avoid loading it in the browser.
  private async initReadline() {
    if (this.initialized) {
      return;
    }
    const readline = await import('readline');
    readline.emitKeypressEvents(process.stdin);
    if(process.stdin.setRawMode instanceof Function){
      process.stdin.setRawMode(true);
    }
    this.initialized = true;
  }

  public notify(address: Address) {}

  public map(vm: VM, mapping: PeripheralMapping){
    super.map(vm, mapping);
    this.initReadline();
    process.stdin.on('keypress', this.onKeypress);
  }

  public unmap(){
    super.unmap();
    process.stdin.off('keypress', this.onKeypress);
  }

  private onKeypress(data: string, key: { name: string }){
    if(!this.mapping || !this.vm){
      this.unmapped();
    }

    const c = key.name.codePointAt(0);
    if(c !== undefined){
      this.mapping.view[this.mapping.base] = c;
      this.vm.interrupt(this.interrupt);
    }
  }
}

/**
 * A simple peripheral for reading files from the host file system.
 */
class DebugFilePeripheral extends BufferedPeripheral {
  public readonly name = 'debug-file';
  public readonly identifier = 0x00000011;

  private path: string = '';

  protected async onWrite(data: number[]): Promise<void> {
    if(!this.path){
      this.path = codePointsToString(data);
      return;
    }

    log.debug(`${this.name}: writing path ${this.path}`);
    await fs.promises.writeFile(this.path, codePointsToString(data), 'utf-8');
    log.debug(`${this.name}: write complete`);
  }

  protected async onRead(): Promise<number[]> {
    if(!this.path){
      throw new Error('no path');
    }
    log.debug(`${this.name}: reading path ${this.path}`);
    const text = await fs.promises.readFile(this.path, 'utf-8');
    log.debug(`${this.name}: read complete`);
    return stringToCodePoints(text);
  }
}

export {
  Peripheral,
  DebugBreakPeripheral,
  DebugOutputPeripheral,
  DebugInputPeripheral,
  DebugFilePeripheral,
  TimerPeripheral,
  KeypressPeripheral,
};
export type { PeripheralMapping };
