import { createFileRenderer } from './file-renderer';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('createFileRenderer', () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'file-renderer-test-'));
    tempFile = path.join(tempDir, 'output.ppm');
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  test('creates valid PPM file', () => {
    const renderer = createFileRenderer(tempFile);
    const pixels = new Uint32Array([
      0xFF0000FF,  // ABGR: Red
      0xFF00FF00,  // ABGR: Green
      0xFFFF0000,  // ABGR: Blue
      0xFFFFFFFF,  // ABGR: White
    ]);

    renderer(pixels, 2, 2);

    const content = fs.readFileSync(tempFile);
    const header = content.slice(0, 11).toString('ascii');
    expect(header).toBe('P6\n2 2\n255\n');

    // Check pixel data (RGB, 3 bytes per pixel)
    const pixelData = content.slice(11);
    expect(pixelData.length).toBe(12);  // 4 pixels * 3 bytes

    // Red pixel (R=255, G=0, B=0)
    expect(pixelData[0]).toBe(0xFF);
    expect(pixelData[1]).toBe(0x00);
    expect(pixelData[2]).toBe(0x00);

    // Green pixel (R=0, G=255, B=0)
    expect(pixelData[3]).toBe(0x00);
    expect(pixelData[4]).toBe(0xFF);
    expect(pixelData[5]).toBe(0x00);

    // Blue pixel (R=0, G=0, B=255)
    expect(pixelData[6]).toBe(0x00);
    expect(pixelData[7]).toBe(0x00);
    expect(pixelData[8]).toBe(0xFF);

    // White pixel (R=255, G=255, B=255)
    expect(pixelData[9]).toBe(0xFF);
    expect(pixelData[10]).toBe(0xFF);
    expect(pixelData[11]).toBe(0xFF);
  });

  test('overwrites file on subsequent renders', () => {
    const renderer = createFileRenderer(tempFile);

    // First render: 2x2
    renderer(new Uint32Array([0, 0, 0, 0]), 2, 2);
    const size1 = fs.statSync(tempFile).size;

    // Second render: 4x4
    renderer(new Uint32Array(16), 4, 4);
    const size2 = fs.statSync(tempFile).size;

    expect(size2).toBeGreaterThan(size1);
  });

  test('handles large dimensions', () => {
    const renderer = createFileRenderer(tempFile);
    const width = 320;
    const height = 200;
    const pixels = new Uint32Array(width * height);

    renderer(pixels, width, height);

    const content = fs.readFileSync(tempFile);
    const headerEnd = content.indexOf(0x0A, content.indexOf(0x0A, 3) + 1) + 1;  // After "255\n"
    const pixelData = content.slice(headerEnd);

    expect(pixelData.length).toBe(width * height * 3);
  });
});
