/**
 * Browser entry point for Quinix.
 * This file is bundled with bun to create build/quinix.js for browser use.
 */

import { LowLevelProgram } from './lowlevel/lowlevel';
import { VM } from './vm/vm';
import { BufferedPeripheral } from './vm/peripheral-base';
import { codePointsToString, stringToCodePoints, release, ResolvablePromise } from './lib/util';

// Import the bare-metal standard library from the source file.
// This is embedded at build time by bun.
import stdlib from '../lib/std.bare.qll' with { type: 'text' };

/**
 * A peripheral to write to a DOM element.
 */
class BrowserOutputPeripheral extends BufferedPeripheral {
  public readonly name = "browser-output";
  public readonly identifier = 0x00000003;

  private outputElement: HTMLElement | null = null;

  public constructor(private readonly outputSelector: string = '#output') {
    super();
  }

  protected async onWrite(data: number[]): Promise<void> {
    await release();

    if (!this.outputElement) {
      this.outputElement = document.querySelector(this.outputSelector);
    }

    const s = codePointsToString(data);
    if (this.outputElement) {
      this.outputElement.textContent += s;
    } else {
      console.log(s);
    }
  }
}

/**
 * A peripheral to read input from a browser input element.
 * Creates an input field with an Enter button above the output.
 */
class BrowserInputPeripheral extends BufferedPeripheral {
  public readonly name = "browser-input";
  public readonly identifier = 0x00000004;

  private inputElement: HTMLInputElement | null = null;
  private buttonElement: HTMLButtonElement | null = null;
  private containerElement: HTMLDivElement | null = null;
  private resolvablePromise?: ResolvablePromise<number[]>;

  public constructor(private readonly outputSelector: string = '#output') {
    super();
  }

  private ensureUI(): void {
    if (this.containerElement) {
      return;
    }

    const outputElement = document.querySelector(this.outputSelector);
    if (!outputElement || !outputElement.parentElement) {
      return;
    }

    // Create container with flex layout
    this.containerElement = document.createElement('div');
    this.containerElement.style.display = 'flex';
    this.containerElement.style.marginBottom = '8px';
    this.containerElement.style.gap = '8px';

    // Create input element
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.style.flex = '1';
    this.inputElement.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.submitInput();
      }
    });

    // Create button element
    this.buttonElement = document.createElement('button');
    this.buttonElement.textContent = 'Enter';
    this.buttonElement.addEventListener('click', () => {
      this.submitInput();
    });

    this.containerElement.appendChild(this.inputElement);
    this.containerElement.appendChild(this.buttonElement);

    // Insert before the output element
    outputElement.parentElement.insertBefore(this.containerElement, outputElement);
  }

  private submitInput(): void {
    if (!this.inputElement || !this.resolvablePromise) {
      return;
    }

    const text = this.inputElement.value;
    this.inputElement.value = '';

    const data = stringToCodePoints(text);
    this.resolvablePromise.resolve(data);
    this.resolvablePromise = undefined;
  }

  protected onRead(): Promise<number[]> {
    this.ensureUI();

    if (this.resolvablePromise) {
      this.resolvablePromise.reject('read while pending');
    }

    // Clear input when starting a new read
    if (this.inputElement) {
      this.inputElement.value = '';
      this.inputElement.focus();
    }

    this.resolvablePromise = new ResolvablePromise<number[]>();
    return this.resolvablePromise.promise;
  }
}

type BrowserVMOptions = {
  cycles?: number;
  outputSelector?: string;
};

/**
 * Creates a VM configured for browser use.
 * Includes browser-specific input and output peripherals.
 */
function createBrowserVM(options?: BrowserVMOptions): VM {
  const outputSelector = options?.outputSelector ?? '#output';

  return new VM({
    cycles: options?.cycles,
    peripherals: [
      new BrowserOutputPeripheral(outputSelector),
      new BrowserInputPeripheral(outputSelector),
    ],
  });
}

export {
  LowLevelProgram,
  VM,
  BrowserOutputPeripheral,
  BrowserInputPeripheral,
  createBrowserVM,
  stdlib,
};
