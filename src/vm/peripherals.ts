import readline from 'readline';
import { logger, stringToCodePoints } from '../lib/util';
import { VM, Interrupt } from './vm';
import { Memory, Address, Offset } from '../lib/base-types';
import { Instruction, Operation, Register, Immediate } from './instructions';

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
      log(`${this.name}: unmapping and clearing interval`);
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
      log(`${this.name}: clearing interval`);
      clearInterval(this.interval);
      this.interval = undefined;
    }

    // Allow disabling the timer entirely.
    if(this.milliseconds){
      log(`${this.name}: configuring interval ${this.milliseconds}`);
      this.interval = setInterval(() => {
        this.intervalHandler();
      }, this.milliseconds);
    }
  }

  private intervalHandler(){
    if(!this.vm){
      this.unmapped();
    }
    log(`${this.name}: interrupting`);
    this.vm.interrupt(this.interrupt);
  }
}

/**
 * A peripheral to write zero-terminated unicode strings to stdout.
 */
class DebugOutputPeripheral extends Peripheral {
  public readonly name = "debug-output";
  public readonly identifier = 0x00000003;

  public readonly io = 0x01;
  public readonly shared: Offset;

  private readonly DEFAULT_BUFFER_SIZE = 0x100;

  private readonly CONTROL_ADDR = 0x0;
  private readonly BUFFER_ADDR = 0x1;

  private readonly COMPLETE = 0x0;
  private readonly WRITE = 0x1;
  private readonly PENDING = 0x2;
  private readonly ERROR = 0xffffffff;

  public constructor(bufferSize?: Offset){
    super();
    this.shared = bufferSize || this.DEFAULT_BUFFER_SIZE;
  }

  public notify(address: Address): void {
    if(!this.mapping){
      this.unmapped();
    }

    log(`${this.name}: notified ${Immediate.toString(address)}`);

    // Verify we are attempting to write.
    const control = this.mapping.view[this.CONTROL_ADDR];
    if(control !== this.WRITE){
      log(`${this.name}: invalid control ${Immediate.toString(control)}`);
      this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
      return;
    }

    // Mark pending.
    this.mapping.view[this.CONTROL_ADDR] = this.PENDING;

    // Make this non-blocking for "realism".
    setTimeout(() => {
      if(!this.mapping){
        this.unmapped();
      }

      log(`${this.name}: reading string...`);

      // Extract a string.
      const size = Math.min(this.mapping.view[this.BUFFER_ADDR] + 1, this.shared);

      const characters = [];
      for(let i = 1; i < size; i++){
        let codePoint = this.mapping.view[this.BUFFER_ADDR + i];
        if(!codePoint){
          break;
        }
        characters.push(String.fromCodePoint(codePoint));
      }
      const s = characters.join('');

      log(`${this.name}: read '${s}'`);

      process.stdout.write(s);

      this.mapping.view[this.CONTROL_ADDR] = this.COMPLETE;
    });
  }
}

/**
 * A peripheral to read newline-terminated strings from stdin.
 * Ideally we'll replace this with a keyboard peripheral and a
 * kernel library.
 */
class DebugInputPeripheral extends Peripheral {
  public readonly name = "debug-input";
  public readonly identifier = 0x00000004;

  public readonly io = 0x01;
  public readonly shared: Offset;

  private readonly DEFAULT_BUFFER_SIZE = 0x100;

  private readonly CONTROL_ADDR = 0x0;
  private readonly BUFFER_ADDR = 0x1;

  private readonly COMPLETE = 0x0;
  private readonly READ = 0x1;
  private readonly PENDING = 0x2;
  private readonly MORE = 0x3;
  private readonly ERROR = 0xffffffff;

  private buffer = '';
  private listening = false;

  public constructor(bufferSize?: Offset){
    super();
    this.shared = bufferSize || this.DEFAULT_BUFFER_SIZE;
  }

  public map(vm: VM, mapping: PeripheralMapping){
    super.map(vm, mapping);
    this.listening = false;
    this.buffer = '';

    // Bind for easier listener removal.
    this.listener = this.listener.bind(this);
  }

  public unmap(){
    super.unmap();
    process.stdin.off('data', this.listener);
    process.stdin.off('end', this.listener);
  }

  public notify(address: Address): void {
    if(!this.mapping){
      this.unmapped();
    }

    // Verify we are attempting to read.
    const control = this.mapping.view[this.CONTROL_ADDR];
    if(control !== this.READ){
      log(`${this.name}: invalid control byte ${Immediate.toString(control)}`);
      this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
      return;
    }

    // Don't allow overlapping reads.
    if(this.listening){
      log(`${this.name}: already listening`);
      this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
      return;
    }

    // Mark pending.
    this.mapping.view[this.CONTROL_ADDR] = this.PENDING;

    // Start listening.
    this.listening = true;
    this.buffer = '';

    process.stdin.on('data', this.listener);
    process.stdin.on('end', this.listener);
  }

  private listener(data?: Buffer){
    if(!this.mapping){
      this.unmapped();
    }

    // End.
    if(data === undefined){
      log(`${this.name}: end of data`);
      this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
      return;
    }

    // Data.
    this.buffer += data.toString("utf8");
    const i = this.buffer.indexOf('\n');
    if(i === -1){
      return;
    }

    // Now we have an input; for now just write it out and be done.
    //
    // TODO: if it's longer than the buffer, do better!
    const input = this.buffer.substr(0, i);
    const codePoints = stringToCodePoints(input);
    const size = Math.min(this.shared - 1, codePoints.length);

    // Set size.
    this.mapping.view[this.BUFFER_ADDR] = codePoints.length;

    // Write codepoints.
    for(let i = 1; i < size; i++){
      this.mapping.view[this.BUFFER_ADDR + i] = codePoints[i - 1];
    }

    // Done.
    this.mapping.view[this.CONTROL_ADDR] = this.COMPLETE;
    this.listening = false;
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
      log(`${this.name}: invalid control ${Immediate.toString(control)}`);
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
 * be included in the test suite for now.
 */
class KeypressPeripheral extends Peripheral {
  public readonly name = 'keypress';
  public readonly identifier = 0x00000010;

  public readonly interrupt: Interrupt = 0x10;

  public readonly io = 0x0;
  public readonly shared = 0x2;

  public constructor(){
    super();

    // Bind for easier listener removal.
    this.onKeypress = this.onKeypress.bind(this);

    readline.emitKeypressEvents(process.stdin);
    if(process.stdin.setRawMode instanceof Function){
      process.stdin.setRawMode(true);
    }
  }

  public notify(address: Address) {}

  public map(vm: VM, mapping: PeripheralMapping){
    super.map(vm, mapping);
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

export {
  Peripheral, PeripheralMapping,
  DebugBreakPeripheral,
  DebugOutputPeripheral,
  DebugInputPeripheral,
  TimerPeripheral,
  KeypressPeripheral,
};
