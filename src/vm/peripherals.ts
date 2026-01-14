import { logger } from "@/lib/logger";
import { Address, Memory, Offset } from "@/lib/types";
import { Immediate, Instruction } from "./instructions";
import type { Interrupt } from "./vm";
import { VM } from "./vm";

const log = logger("vm:peripherals");

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
    if (this.vm) {
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
  public unmap(): void { }

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
  peripheral: Peripheral;
  base: Address;
  view: Memory;
};

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

  public constructor(bufferSize?: Offset) {
    super();

    this.bufferSize = bufferSize ?? this.DEFAULT_BUFFER_SIZE;
    this.shared = 0x2 + this.bufferSize;
  }

  public map(vm: VM, mapping: PeripheralMapping): void {
    super.map(vm, mapping);

    if (!this.mapping) {
      this.unmapped();
    }

    this.mapping.view[this.CAPACITY_ADDR] = this.bufferSize;
    this.mapping.view[this.SIZE_ADDR] = 0x0;
  }

  public notify(address: Address): void {
    if (!this.mapping) {
      this.unmapped();
    }

    const control = this.mapping.view[this.CONTROL_ADDR];

    log.debug(
      `${this.name}: notified buffered peripheral: ${Immediate.toString(
        control,
        1
      )}`
    );

    if (control === this.WRITE) {
      this.mapping.view[this.CONTROL_ADDR] = this.PENDING;
      const isComplete = this.readShared();
      if (!isComplete) {
        this.ready();
        return;
      }
      const outputBuffer = this.outputBuffer;
      this.outputBuffer = [];
      this.onWrite(outputBuffer)
        .then(() => {
          this.ready();
        })
        .catch((e) => {
          this.error(e);
        });
      return;
    }

    if (control === this.READ) {
      this.mapping.view[this.CONTROL_ADDR] = this.PENDING;
      if (this.inputBuffer) {
        this.writeShared();
        this.ready();
        return;
      }
      this.onRead()
        .then((data) => {
          this.inputBuffer = data;
          this.writeShared();
          this.ready();
        })
        .catch((e) => {
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
    return Promise.reject("write not supported");
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
    return Promise.reject("read not supported.");
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
    if (!this.mapping) {
      this.unmapped();
    }

    // Get shared data.
    const sourceSize = this.mapping.view[this.SIZE_ADDR];
    const size = Math.min(sourceSize, this.bufferSize);
    for (var i = 0; i < size; i++) {
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
    if (!this.mapping) {
      this.unmapped();
    }
    if (!this.inputBuffer) {
      throw new Error();
    }

    const dataSize = this.inputBuffer.length;
    const size = Math.min(this.bufferSize, dataSize);

    this.mapping.view[this.SIZE_ADDR] = size;

    for (var i = 0; i < size; i++) {
      this.mapping.view[this.BUFFER_ADDR + i] = this.inputBuffer[i];
    }
    this.inputBuffer.splice(0, size);

    if (dataSize <= this.bufferSize) {
      this.inputBuffer = undefined;
    }
    return !!this.inputBuffer;
  }

  /**
   * Mark the peripheral as ready.
   *
   * @param message optional message to log.
   */
  protected ready(message: string = "complete") {
    log.debug(`${this.name}: ${message}`);
    if (!this.mapping) {
      this.unmapped();
    }
    this.mapping.view[this.CONTROL_ADDR] = this.READY;
  }

  /**
   * Mark the peripheral as in an error state.
   *
   * @param message optional error to log.
   */
  protected error(message: string = "error") {
    log.debug(`${this.name}: ${message}`);
    if (!this.mapping) {
      this.unmapped();
    }
    this.mapping.view[this.CONTROL_ADDR] = this.ERROR;
  }
}

/**
 * A peripheral implementing a "hardware" timer.
 */
class TimerPeripheral extends Peripheral {
  public readonly name = "timer";
  public readonly identifier = 0x00000001;

  public readonly io = 0x1;
  public readonly shared = 0x0;
  public readonly interrupt = 0x2;

  public readonly TIME_ADDR = 0x0;

  private milliseconds = 0;
  private interval?: ReturnType<typeof setInterval>;

  public unmap() {
    if (this.interval) {
      log.debug(`${this.name}: unmapping and clearing interval`);
      clearInterval(this.interval);
    }
  }

  public notify(address: Address): void {
    if (!this.mapping) {
      this.unmapped();
    }

    // Don't do anything if we are already running at this interval.
    const milliseconds = this.mapping.view[0];
    if (this.milliseconds === milliseconds) {
      return;
    }
    this.milliseconds = milliseconds;

    // Clear current interval.
    if (this.interval) {
      log.debug(`${this.name}: clearing interval`);
      clearInterval(this.interval);
      this.interval = undefined;
    }

    // Allow disabling the timer entirely.
    if (this.milliseconds) {
      log.debug(`${this.name}: configuring interval ${this.milliseconds}`);
      this.interval = setInterval(() => {
        this.intervalHandler();
      }, this.milliseconds);
    }
  }

  private intervalHandler() {
    if (!this.vm) {
      this.unmapped();
    }
    log.debug(`${this.name}: interrupting`);
    this.vm.interrupt(this.interrupt);
  }
}

export { BufferedPeripheral, Peripheral, TimerPeripheral };
export type { PeripheralMapping };

