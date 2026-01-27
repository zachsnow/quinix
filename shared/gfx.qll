// Quinix Graphics Library
// Provides bitmap font, drawing primitives, and display helper functions.

namespace gfx {
  // RGBA color helpers
  function rgba(r: byte, g: byte, b: byte, a: byte): byte {
    return (a << 24) | (b << 16) | (g << 8) | r;
  }

  function rgb(r: byte, g: byte, b: byte): byte {
    return rgba(r, g, b, 0xFF);
  }

  // Common colors
  namespace color {
    .constant global BLACK: byte = 0xFF000000;
    .constant global WHITE: byte = 0xFFFFFFFF;
    .constant global RED: byte = 0xFF0000FF;
    .constant global GREEN: byte = 0xFF00FF00;
    .constant global BLUE: byte = 0xFFFF0000;
    .constant global YELLOW: byte = 0xFF00FFFF;
    .constant global CYAN: byte = 0xFFFFFF00;
    .constant global MAGENTA: byte = 0xFFFF00FF;
    .constant global GRAY: byte = 0xFF808080;
  }

  // Framebuffer structure for drawing operations
  type framebuffer = struct {
    pixels: *byte;
    width: byte;
    height: byte;
  };

  // Set a single pixel
  function set_pixel(fb: *framebuffer, x: byte, y: byte, color: byte): void {
    if (x >= fb->width || y >= fb->height) {
      return;
    }
    fb->pixels[unsafe y * fb->width + x] = color;
  }

  // Get a single pixel
  function get_pixel(fb: *framebuffer, x: byte, y: byte): byte {
    if (x >= fb->width || y >= fb->height) {
      return 0;
    }
    return fb->pixels[unsafe y * fb->width + x];
  }

  // Clear framebuffer to a color
  function clear(fb: *framebuffer, color: byte): void {
    var size = fb->width * fb->height;
    for (var i: byte = 0; i < size; i = i + 1) {
      fb->pixels[unsafe i] = color;
    }
  }

  // Draw horizontal line
  function hline(fb: *framebuffer, x: byte, y: byte, w: byte, color: byte): void {
    if (y >= fb->height) {
      return;
    }
    var x2 = x + w;
    if (x2 > fb->width) {
      x2 = fb->width;
    }
    for (var i = x; i < x2; i = i + 1) {
      fb->pixels[unsafe y * fb->width + i] = color;
    }
  }

  // Draw vertical line
  function vline(fb: *framebuffer, x: byte, y: byte, h: byte, color: byte): void {
    if (x >= fb->width) {
      return;
    }
    var y2 = y + h;
    if (y2 > fb->height) {
      y2 = fb->height;
    }
    for (var j = y; j < y2; j = j + 1) {
      fb->pixels[unsafe j * fb->width + x] = color;
    }
  }

  // Draw line using Bresenham's algorithm
  function line(fb: *framebuffer, x0: byte, y0: byte, x1: byte, y1: byte, color: byte): void {
    // Handle horizontal and vertical lines efficiently
    if (y0 == y1) {
      if (x0 > x1) {
        var tmp = x0;
        x0 = x1;
        x1 = tmp;
      }
      hline(fb, x0, y0, x1 - x0 + 1, color);
      return;
    }
    if (x0 == x1) {
      if (y0 > y1) {
        var tmp = y0;
        y0 = y1;
        y1 = tmp;
      }
      vline(fb, x0, y0, y1 - y0 + 1, color);
      return;
    }

    // Bresenham's line algorithm
    var dx: byte = x1 > x0 ? x1 - x0 : x0 - x1;
    var dy: byte = y1 > y0 ? y1 - y0 : y0 - y1;
    var sx: byte = x0 < x1 ? 1 : -1;
    var sy: byte = y0 < y1 ? 1 : -1;
    var err: byte = dx - dy;

    while (true) {
      set_pixel(fb, x0, y0, color);
      if (x0 == x1 && y0 == y1) {
        break;
      }
      var e2: byte = 2 * err;
      if (e2 > 0 - dy) {
        err = err - dy;
        x0 = x0 + sx;
      }
      if (e2 < dx) {
        err = err + dx;
        y0 = y0 + sy;
      }
    }
  }

  // Draw rectangle outline
  function rect(fb: *framebuffer, x: byte, y: byte, w: byte, h: byte, color: byte): void {
    hline(fb, x, y, w, color);
    hline(fb, x, y + h - 1, w, color);
    vline(fb, x, y, h, color);
    vline(fb, x + w - 1, y, h, color);
  }

  // Draw filled rectangle
  function fill_rect(fb: *framebuffer, x: byte, y: byte, w: byte, h: byte, color: byte): void {
    for (var j: byte = 0; j < h; j = j + 1) {
      hline(fb, x, y + j, w, color);
    }
  }

  // Blit (copy) a region from one framebuffer to another
  function blit(
    dst: *framebuffer, dx: byte, dy: byte,
    src: *framebuffer, sx: byte, sy: byte,
    w: byte, h: byte
  ): void {
    for (var j: byte = 0; j < h; j = j + 1) {
      for (var i: byte = 0; i < w; i = i + 1) {
        var color = get_pixel(src, sx + i, sy + j);
        set_pixel(dst, dx + i, dy + j, color);
      }
    }
  }

  // Font support will be added in a separate file (shared/font.qll)
  // due to compiler limitations with large array initializers.
}
