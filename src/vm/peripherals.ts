import { logger } from "@/lib/logger";
import { Address, Memory, Offset } from "@/lib/types";
import { Immediate, Instruction } from "./instructions";
import type { Interrupt } from "./vm";
import { FaultReason, VM } from "./vm";

const log = logger("vm:peripherals");

const CYCLES_PER_MS = 10_000; // 10 MHz virtual clock

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
      this.vm.fault(FaultReason.MEMORY_FAULT, message);
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
   * Called by the VM each yield point with the current cycle count.
   */
  public tick(cycles: number): void {}

  /**
   * Returns the next cycle at which this peripheral needs to fire,
   * or null if it has no pending cycle-based event.
   */
  public nextTick(): number | null { return null; }

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
      // Clear any pending input buffer since we're starting a new operation
      this.inputBuffer = undefined;
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
      // If we have remaining data from a previous large read, return the next chunk
      if (this.inputBuffer && this.inputBuffer.length > 0) {
        this.writeShared();
        this.ready();
        return;
      }
      // Otherwise, call onRead() for fresh data
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
    for (let i = 0; i < size; i++) {
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

    for (let i = 0; i < size; i++) {
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
 * Fires interrupts based on VM cycle count rather than wall-clock time.
 */
class TimerPeripheral extends Peripheral {
  public readonly name = "timer";
  public readonly identifier = 0x00000001;

  public readonly io = 0x1;
  public readonly shared = 0x0;
  public readonly interrupt = 0x2;

  public readonly TIME_ADDR = 0x0;

  private active = false;
  private cycleInterval = 0;
  private nextTarget = 0;

  public unmap() {
    this.active = false;
    this.cycleInterval = 0;
    this.nextTarget = 0;
  }

  public notify(address: Address): void {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    const milliseconds = this.mapping.view[0];

    if (milliseconds === 0) {
      log.debug(`${this.name}: disabled`);
      this.active = false;
      return;
    }

    this.cycleInterval = milliseconds * CYCLES_PER_MS;
    this.nextTarget = this.vm.stats.cycles + this.cycleInterval;
    this.active = true;
    log.debug(`${this.name}: configuring interval ${milliseconds}ms (${this.cycleInterval} cycles)`);
  }

  public tick(cycles: number): void {
    if (!this.vm) {
      this.unmapped();
    }

    while (this.active && cycles >= this.nextTarget) {
      log.debug(`${this.name}: interrupting at cycle ${cycles}`);
      this.vm.interrupt(this.interrupt);
      this.nextTarget += this.cycleInterval;
    }
  }

  public nextTick(): number | null {
    return this.active ? this.nextTarget : null;
  }
}

/**
 * A peripheral providing a millisecond clock.
 * Read the single word to get milliseconds since VM start.
 * Derives time from the VM's cycle counter.
 */
class ClockPeripheral extends Peripheral {
  public readonly name = "clock";
  public readonly identifier = 0x00000006;

  public readonly io = 0x0;
  public readonly shared = 0x1;

  public map(vm: VM, mapping: PeripheralMapping): void {
    super.map(vm, mapping);

    if (!this.mapping) {
      this.unmapped();
    }

    this.mapping.view[0] = 0;
  }

  public tick(cycles: number): void {
    if (!this.mapping) {
      return;
    }
    this.mapping.view[0] = Math.floor(cycles / CYCLES_PER_MS);
  }

  public notify(address: Address): void {
    // No-op: clock is read-only
  }
}

/**
 * Callback type for display rendering.
 * Called on FLIP with the framebuffer pixels.
 */
type DisplayRenderer = (pixels: Uint32Array, width: number, height: number) => void;

/**
 * A framebuffer-based color display peripheral.
 *
 * Memory layout:
 *   0x00: Control register (IO)
 *   0x04: Width (read-only)
 *   0x08: Height (read-only)
 *   0x0C: Framebuffer pointer (physical address)
 *
 * Control values:
 *   0x00: READY
 *   0x01: FLIP - read framebuffer and update display
 *   0x02: PENDING
 *   0xFF: ERROR
 */
class DisplayPeripheral extends Peripheral {
  public readonly name = "display";
  public readonly identifier = 0x00000005;

  public readonly io = 0x1;      // Control register (1 word)
  public readonly shared = 0x3;  // Width + height + pointer (3 words)

  private readonly CONTROL_ADDR = 0x0;
  private readonly WIDTH_ADDR = 0x1;
  private readonly HEIGHT_ADDR = 0x2;
  private readonly POINTER_ADDR = 0x3;

  private readonly READY = 0x00;
  private readonly FLIP = 0x01;
  private readonly PENDING = 0x02;
  private readonly ERROR = 0xff;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly renderer?: DisplayRenderer
  ) {
    super();
  }

  public map(vm: VM, mapping: PeripheralMapping): void {
    super.map(vm, mapping);

    if (!this.mapping) {
      this.unmapped();
    }

    // Initialize read-only dimensions
    this.mapping.view[this.WIDTH_ADDR] = this.width;
    this.mapping.view[this.HEIGHT_ADDR] = this.height;
    this.mapping.view[this.POINTER_ADDR] = 0;  // Null pointer initially
    this.mapping.view[this.CONTROL_ADDR] = this.READY;
  }

  public notify(address: Address): void {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    const control = this.mapping.view[this.CONTROL_ADDR];

    if (control === this.FLIP) {
      this.mapping.view[this.CONTROL_ADDR] = this.PENDING;

      const pointer = this.mapping.view[this.POINTER_ADDR];
      if (pointer && this.renderer) {
        // Read dimensions from shared memory (set by kernel before flip)
        const width = this.mapping.view[this.WIDTH_ADDR];
        const height = this.mapping.view[this.HEIGHT_ADDR];
        const pixelCount = width * height;

        // Read framebuffer from physical memory using dump view
        const framebuffer = this.vm.dump(pointer, pixelCount);
        const pixels = new Uint32Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
          pixels[i] = framebuffer[i];
        }

        this.renderer(pixels, width, height);
      }

      this.mapping.view[this.CONTROL_ADDR] = this.READY;
    }
  }
}

export { BufferedPeripheral, ClockPeripheral, CYCLES_PER_MS, DisplayPeripheral, Peripheral, TimerPeripheral };
export type { DisplayRenderer, PeripheralMapping };

