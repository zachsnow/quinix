/**
 * Minimal type declarations for runtime globals that exist in both
 * browser and Node.js environments. This allows the core code to be
 * type-checked without importing DOM or Node types.
 */

declare var console: {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
};

declare function setTimeout(callback: () => void, ms?: number): number;
declare function clearTimeout(id: number): void;
