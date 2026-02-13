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
const SDLK_LEFT = 0x40000050;
const SDLK_RIGHT = 0x4000004f;
const SDLK_UP = 0x40000052;
const SDLK_DOWN = 0x40000051;
const SDLK_SPACE = 32;
const SDLK_ESCAPE = 27;
const SDLK_a = 97;
const SDLK_d = 100;
const SDLK_w = 119;
const SDLK_s = 115;

// Key state bitmask bits
export const KEY_BIT_LEFT = 0x01;
export const KEY_BIT_RIGHT = 0x02;
export const KEY_BIT_UP = 0x04;
export const KEY_BIT_DOWN = 0x08;
export const KEY_BIT_SPACE = 0x10;
export const KEY_BIT_ESCAPE = 0x20;

function sdlKeyToBit(sym: number): number {
  switch (sym) {
    case SDLK_LEFT: case SDLK_a: return KEY_BIT_LEFT;
    case SDLK_RIGHT: case SDLK_d: return KEY_BIT_RIGHT;
    case SDLK_UP: case SDLK_w: return KEY_BIT_UP;
    case SDLK_DOWN: case SDLK_s: return KEY_BIT_DOWN;
    case SDLK_SPACE: return KEY_BIT_SPACE;
    case SDLK_ESCAPE: return KEY_BIT_ESCAPE;
    default: return 0;
  }
}

export type KeyCallback = (keyState: number) => void;

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

  // Key state bitmask, updated by event pump
  let keyState = 0;

  function pumpEvents(buf: Buffer) {
    while (sdl.symbols.SDL_PollEvent(ptr(buf))) {
      const type = buf.readUInt32LE(0);
      if (type === SDL_KEYDOWN || type === SDL_KEYUP) {
        // SDL_KeyboardEvent: keysym.sym is at byte offset 20
        const sym = buf.readInt32LE(20);
        const bit = sdlKeyToBit(sym);
        if (bit) {
          if (type === SDL_KEYDOWN) {
            keyState |= bit;
          } else {
            keyState &= ~bit;
          }
          if (onKey) {
            onKey(keyState);
          }
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
