/**
 * SDL2-based display renderer for server/CLI usage.
 * Uses Bun's FFI to call SDL2 directly.
 */
import { dlopen, FFIType, ptr, toArrayBuffer } from "bun:ffi";
import type { DisplayRenderer } from "@/vm/peripherals";

// SDL2 constants
const SDL_INIT_VIDEO = 0x00000020;
const SDL_WINDOW_SHOWN = 0x00000004;
const SDL_PIXELFORMAT_RGBA32 = 0x16462004;
const SDL_TEXTUREACCESS_STREAMING = 1;

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
  scale: number = 2
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

  // Background event pump to keep window responsive
  const eventBuffer = Buffer.alloc(64);
  const pollInterval = setInterval(() => {
    while (sdl.symbols.SDL_PollEvent(ptr(eventBuffer))) {
      // Drain event queue to keep window responsive
    }
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
        SDL_PIXELFORMAT_RGBA32,
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

    // Poll events to keep window responsive
    const eventBuffer = Buffer.alloc(64);  // SDL_Event is ~56 bytes
    while (sdl.symbols.SDL_PollEvent(ptr(eventBuffer))) {
      // Just drain the event queue for now
      // Could handle SDL_QUIT etc. here
    }
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
