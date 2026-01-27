# Display Peripheral

A framebuffer-based color display peripheral for Quinix.

## Overview

The display peripheral provides a DMA-style color display. Programs allocate a framebuffer in physical memory and point the peripheral to it. On FLIP, the peripheral reads pixels from that address and updates the display. This mirrors how classic VGA and DMA-based graphics hardware worked.

## Memory Layout

```
Offset  Size    Description
0x00    1 word  Control register (IO - triggers notify)
0x04    1 word  Width in pixels (read-only)
0x08    1 word  Height in pixels (read-only)
0x0C    1 word  Framebuffer pointer (physical address, writable)
```

Total peripheral memory: 16 bytes (4 words)

The framebuffer itself lives elsewhere in physical memory, allocated by the program.

### Control Register

| Value | Name    | Description |
|-------|---------|-------------|
| 0x00  | READY   | Idle state |
| 0x01  | FLIP    | Read framebuffer and update display |
| 0x02  | PENDING | Flip in progress |
| 0xFF  | ERROR   | Error occurred |

### Framebuffer Pointer

Physical address of the framebuffer. The framebuffer must be a contiguous block of `width * height` 32-bit words in RGBA format.

Programs are responsible for allocating this memory. In baremetal/kernel mode, this is straightforward. Usermode programs would request a buffer from the kernel via syscall.

### Pixel Format

Each pixel is one 32-bit word in RGBA order (matches HTML canvas ImageData):

```
Bits 0-7:   Red
Bits 8-15:  Green
Bits 16-23: Blue
Bits 24-31: Alpha (255 = opaque)
```

Example values:
- `0xFF0000FF` = opaque red
- `0xFF00FF00` = opaque green
- `0xFFFF0000` = opaque blue
- `0x00000000` = transparent black

## Implementation

### Peripheral Class

```typescript
type DisplayRenderer = (pixels: Uint32Array, width: number, height: number) => void;

class DisplayPeripheral extends Peripheral {
  public readonly name = "display";
  public readonly identifier = 0x00000002;
  public readonly io = 0x4;      // Control register
  public readonly shared = 0xC;  // Width + height + pointer

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly renderer?: DisplayRenderer
  ) {}

  public map(vm: VM, mapping: PeripheralMapping): void {
    super.map(vm, mapping);
    mapping.view[1] = this.width;
    mapping.view[2] = this.height;
    mapping.view[3] = 0;  // Null pointer initially
  }

  public notify(address: Address): void {
    const control = this.mapping.view[0];
    if (control === 0x01) {  // FLIP
      this.mapping.view[0] = 0x02;  // PENDING

      const pointer = this.mapping.view[3];
      if (pointer && this.renderer) {
        const pixels = new Uint32Array(this.width * this.height);
        for (let i = 0; i < pixels.length; i++) {
          pixels[i] = this.vm.memory[pointer + i];
        }
        this.renderer(pixels, this.width, this.height);
      }

      this.mapping.view[0] = 0x00;  // READY
    }
  }
}
```

### Browser Renderer (platform/browser)

```typescript
function createCanvasRenderer(canvas: HTMLCanvasElement): DisplayRenderer {
  const ctx = canvas.getContext('2d')!;

  return (pixels, width, height) => {
    canvas.width = width;
    canvas.height = height;
    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      imageData.data[i * 4 + 0] = pixel & 0xFF;
      imageData.data[i * 4 + 1] = (pixel >> 8) & 0xFF;
      imageData.data[i * 4 + 2] = (pixel >> 16) & 0xFF;
      imageData.data[i * 4 + 3] = (pixel >> 24) & 0xFF;
    }

    ctx.putImageData(imageData, 0, 0);
  };
}
```

### Server Renderer (platform/server)

Two options:

1. **SDL2 via Bun FFI** - Native window, authentic retro feel
2. **HTTP server + browser** - Opens browser window, reuses browser renderer

Initial implementation will use HTTP+browser as fallback, with SDL2 as a stretch goal.

## Tasks

1. Add `DisplayPeripheral` class to `src/vm/peripherals.ts`
2. Add `DisplayRenderer` type and canvas renderer to `src/platform/browser/`
3. Add HTTP+browser renderer to `src/platform/server/`
4. Add tests for peripheral memory layout and FLIP command
5. Create example program that draws to the display
