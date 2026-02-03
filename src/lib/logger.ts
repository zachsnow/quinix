let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

type LazyArg = (() => unknown) | unknown;

function resolveArg(arg: LazyArg): unknown {
  return typeof arg === "function" ? arg() : arg;
}

export class Logger {
  private readonly namespace: string;

  public constructor(namespace: string = "") {
    this.namespace = namespace;
  }

  public get isVerbose(): boolean {
    return verbose;
  }

  private prefix(): string {
    return this.namespace ? `[${this.namespace}]` : "";
  }

  private dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;

  public debug(...args: LazyArg[]): void {
    if (verbose) {
      const resolved = args.map(resolveArg);
      const p = this.prefix();
      if (p) {
        resolved.unshift(this.dim(p));
      }
      console.debug(...resolved);
    }
  }

  public info(...args: LazyArg[]): void {
    const resolved = args.map(resolveArg);
    const p = this.prefix();
    if (p) {
      resolved.unshift(this.dim(p));
    }
    console.info(...resolved);
  }

  public warn(...args: LazyArg[]): void {
    const resolved = args.map(resolveArg);
    const p = this.prefix();
    if (p) {
      resolved.unshift(this.dim(p));
    }
    console.warn(...resolved);
  }

  public error(...args: LazyArg[]): void {
    const resolved = args.map(resolveArg);
    const p = this.prefix();
    if (p) {
      resolved.unshift(this.dim(p));
    }
    console.error(...resolved);
  }
}

export function logger(namespace: string): Logger {
  return new Logger(namespace);
}
