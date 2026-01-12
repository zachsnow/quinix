let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export class Logger {
  private readonly namespace: string;

  public constructor(namespace: string = "") {
    this.namespace = namespace;
  }

  private prefix(): string {
    return this.namespace ? `[${this.namespace}]` : '';
  }

  private dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;

  public debug(...args: unknown[]): void {
    if (verbose) {
      const p = this.prefix();
      if (p) {
        args.unshift(this.dim(p));
      }
      console.debug(...args);
    }
  }
}

export function logger(namespace: string): Logger {
  return new Logger(namespace);
}
