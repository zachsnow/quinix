/**
 * File-based display renderer for testing/debugging without SDL2.
 * Writes framebuffer to a PPM file on each flip.
 */
import fs from "fs";
import type { DisplayRenderer } from "@/vm/peripherals";

/**
 * Creates a file-based DisplayRenderer.
 * Writes the framebuffer as a PPM image file on each flip.
 */
export function createFileRenderer(outputPath: string): DisplayRenderer {
  return (pixels: Uint32Array, width: number, height: number) => {
    // PPM header: P6 format (binary RGB)
    const header = `P6\n${width} ${height}\n255\n`;
    const headerBytes = Buffer.from(header, "ascii");

    // Convert RGBA pixels to RGB (strip alpha)
    const rgbData = Buffer.alloc(width * height * 3);
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      rgbData[i * 3 + 0] = pixel & 0xff;         // R
      rgbData[i * 3 + 1] = (pixel >> 8) & 0xff;  // G
      rgbData[i * 3 + 2] = (pixel >> 16) & 0xff; // B
    }

    // Write PPM file
    const output = Buffer.concat([headerBytes, rgbData]);
    fs.writeFileSync(outputPath, output);
  };
}
