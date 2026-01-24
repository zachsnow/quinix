import { stringToCodePoints, ResolvablePromise, codePointsToString, release } from '@/lib/util';
import { logger } from '@/lib/logger';
import { VM } from '@/vm/vm';
import type { Interrupt } from '@/vm/vm';
import { Address, Offset } from '@/lib/types';
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
      return words;
    }

    // Read as text
    const text = await fs.promises.readFile(fullPath, 'utf-8');
    log.debug(`${this.name}: read complete`);
    return stringToCodePoints(text);
  }
}

/**
 * Block device storage backend interface.
 */
interface BlockStorage {
  /**
   * Read a sector from storage.
   * @param lba Logical block address
   * @param sectorSize Size of sector in words
   * @returns Array of words representing the sector data
   */
  read(lba: number, sectorSize: number): Promise<number[]>;

  /**
   * Write a sector to storage.
   * @param lba Logical block address
   * @param data Array of words to write
   * @param sectorSize Size of sector in words
   */
  write(lba: number, data: number[], sectorSize: number): Promise<void>;

  /**
   * Flush any pending writes to persistent storage.
   */
  flush(): Promise<void>;

  /**
   * Total number of sectors in the device.
   */
  readonly totalSectors: number;
}

/**
 * In-memory block storage for testing.
 */
class MemoryBlockStorage implements BlockStorage {
  private sectors: Map<number, number[]> = new Map();
  public readonly totalSectors: number;

  constructor(totalSectors: number) {
    this.totalSectors = totalSectors;
  }

  async read(lba: number, sectorSize: number): Promise<number[]> {
    const sector = this.sectors.get(lba);
    if (sector) {
      return [...sector];
    }
    // Return zeros for unwritten sectors
    return new Array(sectorSize).fill(0);
  }

  async write(lba: number, data: number[], sectorSize: number): Promise<void> {
    this.sectors.set(lba, [...data]);
  }

  async flush(): Promise<void> {
    // No-op for memory storage
  }
}

/**
 * File-backed block storage for persistent storage.
 */
class FileBlockStorage implements BlockStorage {
  private filePath: string;
  private fd: fs.promises.FileHandle | null = null;
  public readonly totalSectors: number;
  private readonly sectorSizeBytes: number;

  constructor(filePath: string, totalSectors: number, sectorSizeWords: number = 128) {
    this.filePath = filePath;
    this.totalSectors = totalSectors;
    this.sectorSizeBytes = sectorSizeWords * 4; // 4 bytes per word
  }

  private async ensureOpen(): Promise<fs.promises.FileHandle> {
    if (!this.fd) {
      // Create file if it doesn't exist, open for read/write
      this.fd = await fs.promises.open(this.filePath, 'a+');
      await this.fd.close();
      this.fd = await fs.promises.open(this.filePath, 'r+');
    }
    return this.fd;
  }

  async read(lba: number, sectorSize: number): Promise<number[]> {
    const fd = await this.ensureOpen();
    const offset = lba * this.sectorSizeBytes;
    const buffer = Buffer.alloc(this.sectorSizeBytes);

    const { bytesRead } = await fd.read(buffer, 0, this.sectorSizeBytes, offset);

    const words: number[] = [];
    for (let i = 0; i < sectorSize; i++) {
      if (i * 4 < bytesRead) {
        // Little-endian 32-bit read (unsigned)
        const word = (
          buffer[i * 4] |
          (buffer[i * 4 + 1] << 8) |
          (buffer[i * 4 + 2] << 16) |
          (buffer[i * 4 + 3] << 24)
        ) >>> 0;
        words.push(word);
      } else {
        words.push(0);
      }
    }
    return words;
  }

  async write(lba: number, data: number[], sectorSize: number): Promise<void> {
    const fd = await this.ensureOpen();
    const offset = lba * this.sectorSizeBytes;
    const buffer = Buffer.alloc(this.sectorSizeBytes);

    for (let i = 0; i < sectorSize && i < data.length; i++) {
      const word = data[i] >>> 0;
      // Little-endian 32-bit write
      buffer[i * 4] = word & 0xff;
      buffer[i * 4 + 1] = (word >> 8) & 0xff;
      buffer[i * 4 + 2] = (word >> 16) & 0xff;
      buffer[i * 4 + 3] = (word >> 24) & 0xff;
    }

    await fd.write(buffer, 0, this.sectorSizeBytes, offset);
  }

  async flush(): Promise<void> {
    if (this.fd) {
      await this.fd.sync();
    }
  }

  async close(): Promise<void> {
    if (this.fd) {
      await this.fd.close();
      this.fd = null;
    }
  }
}

/**
 * A block device peripheral simulating a simple disk drive.
 *
 * Uses DMA-style transfers: the client specifies an LBA, sector count,
 * and buffer address in main memory. The peripheral reads/writes
 * directly to/from that memory region.
 *
 * Memory layout (shared region):
 *   0x00  STATUS        - Device status (read-only from client perspective)
 *   0x01  LBA           - Logical block address for operation
 *   0x02  COUNT         - Number of sectors to transfer (1-255)
 *   0x03  BUFFER_PTR    - DMA address in main memory
 *   0x04  TOTAL_SECTORS - Device capacity (read-only)
 *   0x05  SECTOR_SIZE   - Words per sector (read-only)
 *   0x06  ERROR_CODE    - Last error code (read-only)
 *
 * IO region (triggers operation on write):
 *   0x00  COMMAND       - Command to execute
 *
 * Commands:
 *   0x00  NOP           - No operation
 *   0x01  READ          - Read sectors from LBA into BUFFER_PTR
 *   0x02  WRITE         - Write sectors from BUFFER_PTR to LBA
 *   0x03  FLUSH         - Ensure all writes are persisted
 *
 * Status values:
 *   0x00  READY         - Device idle
 *   0x01  BUSY          - Operation in progress
 *   0xFF  ERROR         - Operation failed, check ERROR_CODE
 *
 * Error codes:
 *   0x00  NONE          - No error
 *   0x01  INVALID_LBA   - LBA out of range
 *   0x02  INVALID_COUNT - Count is 0 or would exceed device
 *   0x03  IO_ERROR      - Storage backend error
 */
class BlockDevicePeripheral extends Peripheral {
  public readonly name = 'block-device';
  public readonly identifier = 0x00000020;

  // IO region: just the command byte
  public readonly io: Offset = 0x1;

  // Shared region for status and parameters
  public readonly shared: Offset = 0x7;

  // Shared memory layout
  private readonly STATUS_ADDR = 0x0;
  private readonly LBA_ADDR = 0x1;
  private readonly COUNT_ADDR = 0x2;
  private readonly BUFFER_PTR_ADDR = 0x3;
  private readonly TOTAL_SECTORS_ADDR = 0x4;
  private readonly SECTOR_SIZE_ADDR = 0x5;
  private readonly ERROR_CODE_ADDR = 0x6;

  // Commands
  private readonly CMD_NOP = 0x0;
  private readonly CMD_READ = 0x1;
  private readonly CMD_WRITE = 0x2;
  private readonly CMD_FLUSH = 0x3;

  // Status values
  private readonly STATUS_READY = 0x0;
  private readonly STATUS_BUSY = 0x1;
  private readonly STATUS_ERROR = 0xff;

  // Error codes
  private readonly ERR_NONE = 0x0;
  private readonly ERR_INVALID_LBA = 0x1;
  private readonly ERR_INVALID_COUNT = 0x2;
  private readonly ERR_IO_ERROR = 0x3;

  // Sector size in words (128 words = 512 bytes)
  public readonly sectorSize: number;

  private storage: BlockStorage;

  constructor(storage: BlockStorage, sectorSize: number = 128) {
    super();
    this.storage = storage;
    this.sectorSize = sectorSize;
  }

  public map(vm: VM, mapping: PeripheralMapping): void {
    super.map(vm, mapping);

    if (!this.mapping) {
      this.unmapped();
    }

    // Initialize read-only fields
    this.mapping.view[this.STATUS_ADDR] = this.STATUS_READY;
    this.mapping.view[this.TOTAL_SECTORS_ADDR] = this.storage.totalSectors;
    this.mapping.view[this.SECTOR_SIZE_ADDR] = this.sectorSize;
    this.mapping.view[this.ERROR_CODE_ADDR] = this.ERR_NONE;
  }

  public notify(address: Address): void {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    // Read command from IO region (offset 0 in the io view, which is at base + shared)
    const ioBase = this.mapping.base + this.shared;
    const command = this.vm.dump(ioBase, 1)[0];

    log.debug(`${this.name}: command ${Immediate.toString(command, 1)}`);

    if (command === this.CMD_NOP) {
      return;
    }

    // Mark busy
    this.mapping.view[this.STATUS_ADDR] = this.STATUS_BUSY;
    this.mapping.view[this.ERROR_CODE_ADDR] = this.ERR_NONE;

    if (command === this.CMD_READ) {
      this.doRead();
    } else if (command === this.CMD_WRITE) {
      this.doWrite();
    } else if (command === this.CMD_FLUSH) {
      this.doFlush();
    } else {
      this.setError(this.ERR_IO_ERROR);
    }
  }

  private doRead(): void {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    const lba = this.mapping.view[this.LBA_ADDR];
    const count = this.mapping.view[this.COUNT_ADDR];
    const bufferPtr = this.mapping.view[this.BUFFER_PTR_ADDR];

    log.debug(`${this.name}: READ lba=${lba} count=${count} buffer=${Immediate.toString(bufferPtr)}`);

    // Validate parameters
    if (lba >= this.storage.totalSectors) {
      this.setError(this.ERR_INVALID_LBA);
      return;
    }
    if (count === 0 || lba + count > this.storage.totalSectors) {
      this.setError(this.ERR_INVALID_COUNT);
      return;
    }

    // Read sectors sequentially
    this.readSectors(lba, count, bufferPtr, 0);
  }

  private readSectors(lba: number, remaining: number, bufferPtr: Address, offset: number): void {
    if (remaining === 0) {
      this.setReady();
      return;
    }

    this.storage.read(lba, this.sectorSize)
      .then((data) => {
        if (!this.vm) {
          this.unmapped();
        }

        // Write sector data to main memory via DMA
        const targetAddr = bufferPtr + offset;
        const view = this.vm.dump(targetAddr, this.sectorSize);
        for (let i = 0; i < data.length; i++) {
          view[i] = data[i];
        }

        // Continue with next sector
        this.readSectors(lba + 1, remaining - 1, bufferPtr, offset + this.sectorSize);
      })
      .catch((e) => {
        log.debug(`${this.name}: read error: ${e}`);
        this.setError(this.ERR_IO_ERROR);
      });
  }

  private doWrite(): void {
    if (!this.mapping || !this.vm) {
      this.unmapped();
    }

    const lba = this.mapping.view[this.LBA_ADDR];
    const count = this.mapping.view[this.COUNT_ADDR];
    const bufferPtr = this.mapping.view[this.BUFFER_PTR_ADDR];

    log.debug(`${this.name}: WRITE lba=${lba} count=${count} buffer=${Immediate.toString(bufferPtr)}`);

    // Validate parameters
    if (lba >= this.storage.totalSectors) {
      this.setError(this.ERR_INVALID_LBA);
      return;
    }
    if (count === 0 || lba + count > this.storage.totalSectors) {
      this.setError(this.ERR_INVALID_COUNT);
      return;
    }

    // Write sectors sequentially
    this.writeSectors(lba, count, bufferPtr, 0);
  }

  private writeSectors(lba: number, remaining: number, bufferPtr: Address, offset: number): void {
    if (remaining === 0) {
      this.setReady();
      return;
    }

    if (!this.vm) {
      this.unmapped();
    }

    // Read sector data from main memory via DMA
    const sourceAddr = bufferPtr + offset;
    const view = this.vm.dump(sourceAddr, this.sectorSize);
    const data: number[] = [];
    for (let i = 0; i < this.sectorSize; i++) {
      data.push(view[i]);
    }

    this.storage.write(lba, data, this.sectorSize)
      .then(() => {
        // Continue with next sector
        this.writeSectors(lba + 1, remaining - 1, bufferPtr, offset + this.sectorSize);
      })
      .catch((e) => {
        log.debug(`${this.name}: write error: ${e}`);
        this.setError(this.ERR_IO_ERROR);
      });
  }

  private doFlush(): void {
    this.storage.flush()
      .then(() => {
        this.setReady();
      })
      .catch((e) => {
        log.debug(`${this.name}: flush error: ${e}`);
        this.setError(this.ERR_IO_ERROR);
      });
  }

  private setReady(): void {
    if (!this.mapping) {
      this.unmapped();
    }
    this.mapping.view[this.STATUS_ADDR] = this.STATUS_READY;
  }

  private setError(code: number): void {
    if (!this.mapping) {
      this.unmapped();
    }
    this.mapping.view[this.STATUS_ADDR] = this.STATUS_ERROR;
    this.mapping.view[this.ERROR_CODE_ADDR] = code;
  }
}

export {
  DebugBreakPeripheral,
  DebugOutputPeripheral,
  DebugInputPeripheral,
  DebugFilePeripheral,
  KeypressPeripheral,
  BlockDevicePeripheral,
  MemoryBlockStorage,
  FileBlockStorage,
};
export type { BlockStorage };
