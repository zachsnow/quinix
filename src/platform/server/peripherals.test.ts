import { MemoryBlockStorage, FileBlockStorage, BlockDevicePeripheral } from './peripherals';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('MemoryBlockStorage', () => {
  test('reads zeros from unwritten sectors', async () => {
    const storage = new MemoryBlockStorage(100);
    const data = await storage.read(0, 128);
    expect(data.length).toBe(128);
    expect(data.every(v => v === 0)).toBe(true);
  });

  test('writes and reads back data', async () => {
    const storage = new MemoryBlockStorage(100);
    const testData = [0xdeadbeef, 0xcafebabe, 0x12345678];

    await storage.write(5, testData, 128);
    const data = await storage.read(5, 128);

    expect(data[0]).toBe(0xdeadbeef);
    expect(data[1]).toBe(0xcafebabe);
    expect(data[2]).toBe(0x12345678);
  });

  test('isolates sectors from each other', async () => {
    const storage = new MemoryBlockStorage(100);

    await storage.write(0, [0x11111111], 128);
    await storage.write(1, [0x22222222], 128);

    const sector0 = await storage.read(0, 128);
    const sector1 = await storage.read(1, 128);

    expect(sector0[0]).toBe(0x11111111);
    expect(sector1[0]).toBe(0x22222222);
  });

  test('reports correct total sectors', () => {
    const storage = new MemoryBlockStorage(1024);
    expect(storage.totalSectors).toBe(1024);
  });
});

describe('FileBlockStorage', () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'block-device-test-'));
    tempFile = path.join(tempDir, 'disk.img');
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  test('creates file on first write', async () => {
    const storage = new FileBlockStorage(tempFile, 100, 128);
    await storage.write(0, [0xdeadbeef], 128);
    await storage.close();

    const exists = await fs.promises.access(tempFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('persists data across instances', async () => {
    const storage1 = new FileBlockStorage(tempFile, 100, 128);
    await storage1.write(0, [0xdeadbeef, 0xcafebabe], 128);
    await storage1.flush();
    await storage1.close();

    const storage2 = new FileBlockStorage(tempFile, 100, 128);
    const data = await storage2.read(0, 128);
    await storage2.close();

    expect(data[0]).toBe(0xdeadbeef);
    expect(data[1]).toBe(0xcafebabe);
  });

  test('reads zeros from unwritten sectors', async () => {
    const storage = new FileBlockStorage(tempFile, 100, 128);
    await storage.write(5, [0x12345678], 128); // Write to sector 5

    const sector0 = await storage.read(0, 128); // Read sector 0
    await storage.close();

    expect(sector0[0]).toBe(0);
  });

  test('handles writes at different LBAs', async () => {
    const storage = new FileBlockStorage(tempFile, 100, 128);

    await storage.write(0, [0x11111111], 128);
    await storage.write(10, [0x22222222], 128);
    await storage.write(99, [0x33333333], 128);

    const sector0 = await storage.read(0, 128);
    const sector10 = await storage.read(10, 128);
    const sector99 = await storage.read(99, 128);
    await storage.close();

    expect(sector0[0]).toBe(0x11111111);
    expect(sector10[0]).toBe(0x22222222);
    expect(sector99[0]).toBe(0x33333333);
  });
});

describe('BlockDevicePeripheral', () => {
  test('initializes with correct metadata', () => {
    const storage = new MemoryBlockStorage(2048);
    const peripheral = new BlockDevicePeripheral(storage, 128);

    expect(peripheral.name).toBe('block-device');
    expect(peripheral.identifier).toBe(0x00000020);
    expect(peripheral.io).toBe(1);
    expect(peripheral.shared).toBe(7);
    expect(peripheral.sectorSize).toBe(128);
  });

  test('accepts custom sector size', () => {
    const storage = new MemoryBlockStorage(100);
    const peripheral = new BlockDevicePeripheral(storage, 64);
    expect(peripheral.sectorSize).toBe(64);
  });
});
