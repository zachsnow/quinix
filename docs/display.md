# Display & Keyboard Peripherals

Framebuffer-based color display and keyboard input peripherals for Quinix.

## Display Peripheral

### Overview

The display peripheral provides a DMA-style color display. Programs allocate a framebuffer in memory
and point the peripheral to it. On FLIP, the peripheral reads pixels from that address and updates the
display. This is how classic VGA and DMA-based graphics hardware worked.

The display supports user-specified resolutions: the kernel writes the requested width and height
to shared memory before each FLIP, similar to DOS video modes.

### Memory Layout

Memory is word-addressed (each offset is one 32-bit word).

```
Offset  Description
+0      Control register (IO - triggers notify)
+1      Width in pixels (writable)
+2      Height in pixels (writable)
+3      Framebuffer pointer (physical address, writable)
```

Total peripheral memory: 4 words (1 IO + 3 shared).

The framebuffer itself lives elsewhere in physical memory, allocated by the program (baremetal) or kernel (usermode).

### Control Register

| Value | Name    | Description |
|-------|---------|-------------|
| 0x00  | READY   | Idle state |
| 0x01  | FLIP    | Read framebuffer and update display |
| 0x02  | PENDING | Flip in progress |
| 0xFF  | ERROR   | Error occurred |

### Pixel Format

Each pixel is one 32-bit word in RGBA order:

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

### Renderers

Two rendering backends are available:

- **SDL2 via Bun FFI** (`src/platform/server/sdl-renderer.ts`) — Native window using SDL2. Supports dynamic resolution changes. Enable with `--display WxH`.
- **HTML Canvas** (`src/platform/browser/`) — Browser-based rendering for the web interface.

## Keyboard Peripheral

### Overview

The keyboard peripheral provides real-time key state as a single bitmask word. Programs poll the bitmask to check which keys are currently held down.

### Memory Layout

```
Offset  Description
+0      Key state bitmask (shared, read-only from program's perspective)
```

### Key Bitmask

| Bit  | Value | Key |
|------|-------|-----|
| 0    | 0x01  | Left arrow |
| 1    | 0x02  | Right arrow |
| 2    | 0x04  | Up arrow |
| 3    | 0x08  | Down arrow |
| 4    | 0x10  | Space |
| 5    | 0x20  | Escape |

The SDL renderer updates this bitmask on key-down/key-up events.

## Peripheral Identifiers

| Peripheral | Identifier |
|------------|------------|
| Display    | 0x5        |
| Keyboard   | 0x10       |

## Usage

### Baremetal

Baremetal programs access peripherals directly via physical addresses:

```c
// Initialize display at known peripheral base address
var fb = display::init(DISPLAY_BASE, SCREEN_W, SCREEN_H);
graphics::clear(&fb, graphics::color::BLACK);
graphics::fill_rect(&fb, 10, 10, 50, 50, graphics::color::RED);
display::flip(DISPLAY_BASE);

// Read keyboard state
var keys = keyboard::read(KEYBOARD_BASE);
if (keys & keyboard::KEY_LEFT) { /* ... */ }
```

Run with: `bun run bin/qvm.ts program.qbin --display 320x200 --keyboard`

### Usermode (Kernel)

Usermode programs use syscalls. The kernel maps the framebuffer into the process's virtual address space:

```c
// Request a 320x200 display
var fb = display::open(320, 200);
graphics::clear(&fb, graphics::color::BLACK);
graphics::fill_rect(&fb, 10, 10, 50, 50, graphics::color::RED);
display::flip();
display::close();

// Read keyboard state
var keys = keyboard::read();
if (keys & keyboard::KEY_LEFT) { /* ... */ }
```

Run with: `bun run bin/qvm.ts kernel/kernel.qbin --disk image/disk.qfs --display 320x200 --keyboard`

### Display Syscalls

| Syscall | Number | Args | Description |
|---------|--------|------|-------------|
| DISPLAY_OPEN  | 0x9 | result_ptr, width, height | Open display at requested resolution |
| DISPLAY_FLIP  | 0xA | (none) | Present framebuffer to screen |
| DISPLAY_CLOSE | 0xB | (none) | Release display ownership |
| KEY_STATE     | 0xC | (none) | Returns key bitmask in r0 |

`DISPLAY_OPEN` allocates a framebuffer in physical memory, maps it into the calling process's virtual address space at `0x40000`, and writes `{fb_addr, width, height}` to the result struct. Only one process can own the display at a time.

## Graphics Library

The `shared/graphics.qll` library provides drawing primitives that work with the framebuffer:

- `graphics::clear(fb, color)` — Clear entire framebuffer
- `graphics::fill_rect(fb, x, y, w, h, color)` — Filled rectangle
- `graphics::fill_circle(fb, cx, cy, r, color)` — Filled circle
- `graphics::font::draw_char(fb, x, y, ch, fg, bg)` — Draw character (5x7 bitmap font)
- `graphics::font::draw_string(fb, x, y, str, fg, bg)` — Draw string

Predefined colors in `graphics::color::`: `BLACK`, `WHITE`, `RED`, `GREEN`, `BLUE`, `YELLOW`, `GRAY`.
