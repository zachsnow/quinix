/**
 * SDL2-based display renderer for server/CLI usage.
 * Uses Bun's FFI to call SDL2 directly.
 */
import { dlopen, FFIType, ptr, toArrayBuffer } from "bun:ffi";
import type { DisplayRenderer } from "@/vm/peripherals";

// SDL2 constants
const SDL_INIT_VIDEO = 0x00000020;
const SDL_WINDOW_SHOWN = 0x00000004;
const SDL_PIXELFORMAT_ARGB8888 = 0x16362004;
const SDL_TEXTUREACCESS_STREAMING = 1;

// SDL event types
const SDL_KEYDOWN = 0x300;
const SDL_KEYUP = 0x301;
const SDL_QUIT = 0x100;

// SDL keycodes
const SDLK_BACKSPACE = 8;
const SDLK_TAB = 9;
const SDLK_RETURN = 13;
const SDLK_ESCAPE = 27;
const SDLK_SPACE = 32;
const SDLK_DELETE = 127;
const SDLK_UP = 0x40000052;
const SDLK_DOWN = 0x40000051;
const SDLK_LEFT = 0x40000050;
const SDLK_RIGHT = 0x4000004f;
const SDLK_LSHIFT = 0x400000e1;
const SDLK_RSHIFT = 0x400000e5;
const SDLK_LCTRL = 0x400000e0;
const SDLK_RCTRL = 0x400000e4;
const SDLK_LALT = 0x400000e2;
const SDLK_RALT = 0x400000e6;
const SDLK_LGUI = 0x400000e3;
const SDLK_RGUI = 0x400000e7;

// Keyboard state: 5 words mapped to the peripheral.
//
// Word 0: Special/modifier key bitmask.
// Words 1-4: ASCII key state. Bit N of word M means ASCII code (M-1)*32 + N.
//   Word 1: ASCII 0-31 (control characters)
//   Word 2: ASCII 32-63 (space, digits, punctuation)
//   Word 3: ASCII 64-95 (uppercase letters, @, [, \, ], ^, _)
//   Word 4: ASCII 96-127 (lowercase letters, backtick, {, |, }, ~)
export const KEY_WORDS = 5;

// Word 0 bit assignments: special/modifier keys.
export const KEY_BIT_LEFT = 0x01;
export const KEY_BIT_RIGHT = 0x02;
export const KEY_BIT_UP = 0x04;
export const KEY_BIT_DOWN = 0x08;
export const KEY_BIT_SPACE = 0x10;
export const KEY_BIT_ESCAPE = 0x20;
export const KEY_BIT_ENTER = 0x40;
export const KEY_BIT_TAB = 0x80;
export const KEY_BIT_BACKSPACE = 0x100;
export const KEY_BIT_DELETE = 0x200;
export const KEY_BIT_SHIFT = 0x400;
export const KEY_BIT_CTRL = 0x800;
export const KEY_BIT_ALT = 0x1000;
export const KEY_BIT_META = 0x2000;

// Map an SDL keycode to { word, bit } in the 5-word key state.
// Returns undefined if the key isn't mapped.
function sdlKeyToState(sym: number): { word: number; bit: number } | undefined {
  // Special/modifier keys → word 0.
  switch (sym) {
    case SDLK_LEFT: return { word: 0, bit: KEY_BIT_LEFT };
    case SDLK_RIGHT: return { word: 0, bit: KEY_BIT_RIGHT };
    case SDLK_UP: return { word: 0, bit: KEY_BIT_UP };
    case SDLK_DOWN: return { word: 0, bit: KEY_BIT_DOWN };
    case SDLK_SPACE: return { word: 0, bit: KEY_BIT_SPACE };
    case SDLK_ESCAPE: return { word: 0, bit: KEY_BIT_ESCAPE };
    case SDLK_RETURN: return { word: 0, bit: KEY_BIT_ENTER };
    case SDLK_TAB: return { word: 0, bit: KEY_BIT_TAB };
    case SDLK_BACKSPACE: return { word: 0, bit: KEY_BIT_BACKSPACE };
    case SDLK_DELETE: return { word: 0, bit: KEY_BIT_DELETE };
    case SDLK_LSHIFT: case SDLK_RSHIFT: return { word: 0, bit: KEY_BIT_SHIFT };
    case SDLK_LCTRL: case SDLK_RCTRL: return { word: 0, bit: KEY_BIT_CTRL };
    case SDLK_LALT: case SDLK_RALT: return { word: 0, bit: KEY_BIT_ALT };
    case SDLK_LGUI: case SDLK_RGUI: return { word: 0, bit: KEY_BIT_META };
  }

  // ASCII keys (0-127) → words 1-4.
  if (sym >= 0 && sym <= 127) {
    const word = 1 + ((sym >> 5) | 0);  // sym / 32, offset by 1
    const bit = 1 << (sym & 31);        // sym % 32
    return { word, bit };
  }

  return undefined;
}

// Also map WASD to arrow bits for convenience (in addition to their ASCII positions).
const WASD_MAP: Record<number, number> = {
  97:  KEY_BIT_LEFT,   // 'a'
  100: KEY_BIT_RIGHT,  // 'd'
  119: KEY_BIT_UP,     // 'w'
  115: KEY_BIT_DOWN,   // 's'
};

export type KeyCallback = (keyState: Int32Array) => void;

// Find SDL2 library path based on platform
function getSDLPath(): string {
  if (process.platform === "darwin") {
    // Try Homebrew paths
    const paths = [
      "/opt/homebrew/lib/libSDL2.dylib",  // Apple Silicon
      "/usr/local/lib/libSDL2.dylib",      // Intel
      "libSDL2.dylib",                      // System path
    ];
    for (const p of paths) {
      try {
        // Test if file exists by trying to open it
        Bun.file(p).size;
        return p;
      } catch {
        continue;
      }
    }
    return "libSDL2.dylib";  // Fall back to system search
  } else if (process.platform === "linux") {
    return "libSDL2.so";
  } else if (process.platform === "win32") {
    return "SDL2.dll";
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

// SDL2 FFI bindings
const sdl = dlopen(getSDLPath(), {
  SDL_SetHint: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.i32,
  },
  SDL_Init: {
    args: [FFIType.u32],
    returns: FFIType.i32,
  },
  SDL_Quit: {
    args: [],
    returns: FFIType.void,
  },
  SDL_CreateWindow: {
    args: [FFIType.cstring, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u32],
    returns: FFIType.ptr,
  },
  SDL_DestroyWindow: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  SDL_CreateRenderer: {
    args: [FFIType.ptr, FFIType.i32, FFIType.u32],
    returns: FFIType.ptr,
  },
  SDL_DestroyRenderer: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  SDL_CreateTexture: {
    args: [FFIType.ptr, FFIType.u32, FFIType.i32, FFIType.i32, FFIType.i32],
    returns: FFIType.ptr,
  },
  SDL_DestroyTexture: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  SDL_UpdateTexture: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  SDL_RenderClear: {
    args: [FFIType.ptr],
    returns: FFIType.i32,
  },
  SDL_RenderCopy: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  SDL_RenderPresent: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  SDL_GetError: {
    args: [],
    returns: FFIType.cstring,
  },
  SDL_PollEvent: {
    args: [FFIType.ptr],
    returns: FFIType.i32,
  },
  SDL_RaiseWindow: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
});

// SDL_WINDOWPOS_CENTERED
const SDL_WINDOWPOS_CENTERED = 0x2FFF0000;

/**
 * Creates an SDL2-based DisplayRenderer.
 * Opens a window and renders frames to it.
 */
export function createSDLRenderer(
  title: string = "Quinix Display",
  scale: number = 2,
  onKey?: KeyCallback,
): { renderer: DisplayRenderer; cleanup: () => void } {
  // Set app name hint before init (for macOS menu bar)
  const appNameHint = Buffer.from("SDL_APP_NAME\0", "utf8");
  const appNameValue = Buffer.from("Quinix\0", "utf8");
  sdl.symbols.SDL_SetHint(ptr(appNameHint), ptr(appNameValue));

  // Initialize SDL
  if (sdl.symbols.SDL_Init(SDL_INIT_VIDEO) < 0) {
    throw new Error(`SDL_Init failed: ${sdl.symbols.SDL_GetError()}`);
  }

  let window: ReturnType<typeof sdl.symbols.SDL_CreateWindow> | null = null;
  let renderer: ReturnType<typeof sdl.symbols.SDL_CreateRenderer> | null = null;
  let texture: ReturnType<typeof sdl.symbols.SDL_CreateTexture> | null = null;
  let currentWidth = 0;
  let currentHeight = 0;

  // Encode title as null-terminated buffer
  const titleBuffer = Buffer.from(title + "\0", "utf8");

  // Key state: 5 words (word 0 = special/modifier, words 1-4 = ASCII).
  const keyState = new Int32Array(KEY_WORDS);

  function pumpEvents(buf: Buffer) {
    while (sdl.symbols.SDL_PollEvent(ptr(buf))) {
      const type = buf.readUInt32LE(0);
      if (type === SDL_KEYDOWN || type === SDL_KEYUP) {
        // SDL_KeyboardEvent: keysym.sym is at byte offset 20
        const sym = buf.readInt32LE(20);
        let changed = false;

        const state = sdlKeyToState(sym);
        if (state) {
          if (type === SDL_KEYDOWN) {
            keyState[state.word] |= state.bit;
          } else {
            keyState[state.word] &= ~state.bit;
          }
          changed = true;
        }

        // WASD also sets arrow bits in word 0.
        const wasdBit = WASD_MAP[sym];
        if (wasdBit) {
          if (type === SDL_KEYDOWN) {
            keyState[0] |= wasdBit;
          } else {
            keyState[0] &= ~wasdBit;
          }
          changed = true;
        }

        if (changed && onKey) {
          onKey(keyState);
        }
      }
    }
  }

  // Background event pump to keep window responsive
  const eventBuffer = Buffer.alloc(64);
  const pollInterval = setInterval(() => {
    pumpEvents(eventBuffer);
  }, 50);

  const displayRenderer: DisplayRenderer = (pixels, width, height) => {
    // Create or recreate window/texture if dimensions changed
    if (width !== currentWidth || height !== currentHeight) {
      // Clean up old resources
      if (texture) {
        sdl.symbols.SDL_DestroyTexture(texture);
      }
      if (renderer) {
        sdl.symbols.SDL_DestroyRenderer(renderer);
      }
      if (window) {
        sdl.symbols.SDL_DestroyWindow(window);
      }

      // Create window at scaled size
      window = sdl.symbols.SDL_CreateWindow(
        ptr(titleBuffer),
        SDL_WINDOWPOS_CENTERED,
        SDL_WINDOWPOS_CENTERED,
        width * scale,
        height * scale,
        SDL_WINDOW_SHOWN
      );
      if (!window) {
        throw new Error(`SDL_CreateWindow failed: ${sdl.symbols.SDL_GetError()}`);
      }

      // Raise window to front (needed on macOS)
      sdl.symbols.SDL_RaiseWindow(window);

      // Create renderer
      renderer = sdl.symbols.SDL_CreateRenderer(window, -1, 0);
      if (!renderer) {
        throw new Error(`SDL_CreateRenderer failed: ${sdl.symbols.SDL_GetError()}`);
      }

      // Create texture at native resolution
      texture = sdl.symbols.SDL_CreateTexture(
        renderer,
        SDL_PIXELFORMAT_ARGB8888,
        SDL_TEXTUREACCESS_STREAMING,
        width,
        height
      );
      if (!texture) {
        throw new Error(`SDL_CreateTexture failed: ${sdl.symbols.SDL_GetError()}`);
      }

      currentWidth = width;
      currentHeight = height;
    }

    if (!renderer || !texture) {
      return;
    }

    // Convert Uint32Array to Buffer for FFI
    const pixelBuffer = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);

    // Update texture with pixel data
    const pitch = width * 4;  // 4 bytes per pixel (RGBA)
    sdl.symbols.SDL_UpdateTexture(texture, null, ptr(pixelBuffer), pitch);

    // Clear, copy texture, and present
    sdl.symbols.SDL_RenderClear(renderer);
    sdl.symbols.SDL_RenderCopy(renderer, texture, null, null);
    sdl.symbols.SDL_RenderPresent(renderer);

    // Poll events to keep window responsive and capture key state
    pumpEvents(Buffer.alloc(64));
  };

  const cleanup = () => {
    clearInterval(pollInterval);
    if (texture) {
      sdl.symbols.SDL_DestroyTexture(texture);
      texture = null;
    }
    if (renderer) {
      sdl.symbols.SDL_DestroyRenderer(renderer);
      renderer = null;
    }
    if (window) {
      sdl.symbols.SDL_DestroyWindow(window);
      window = null;
    }
    sdl.symbols.SDL_Quit();
  };

  return { renderer: displayRenderer, cleanup };
}
