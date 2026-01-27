# Display Peripheral

A framebuffer-based color display peripheral for Quinix.

## Overview

The display peripheral provides a DMA-style color display. Programs allocate a framebuffer in physical memory and point the peripheral to it. On FLIP, the peripheral reads pixels from that address and updates the display. This mirrors how classic VGA and DMA-based graphics hardware worked.

## Memory Layout

Memory is word-addressed (each offset is one 32-bit word).

```
Offset  Description
+0      Control register (IO - triggers notify)
+1      Width in pixels (read-only)
+2      Height in pixels (read-only)
+3      Framebuffer pointer (physical address, writable)
```

Total peripheral memory: 4 words (1 IO + 3 shared)

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
  public readonly io = 0x1;      // Control register (1 word)
  public readonly shared = 0x3;  // Width + height + pointer (3 words)

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
        const pixelCount = this.width * this.height;
        const framebuffer = this.vm.dump(pointer, pixelCount);
        const pixels = new Uint32Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
          pixels[i] = framebuffer[i];
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

- [x] Add `DisplayPeripheral` class to `src/vm/peripherals.ts`
- [x] Add `DisplayRenderer` type and canvas renderer to `src/platform/browser/`
- [x] Add tests for peripheral memory layout and FLIP command
- [ ] Add HTTP+browser renderer to `src/platform/server/`
- [ ] Create example program that draws to the display
