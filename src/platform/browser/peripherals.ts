import {
  codePointsToString,
  release,
  ResolvablePromise,
  stringToCodePoints,
} from "../../lib/util";
import { BufferedPeripheral } from "../../vm/peripherals";

/**
 * A peripheral to write to a DOM element.
 */
class BrowserOutputPeripheral extends BufferedPeripheral {
  public readonly name = "browser-output";
  public readonly identifier = 0x00000003;

  public constructor(private readonly outputSelector: string = "#output") {
    super();
  }

  protected async onWrite(data: number[]): Promise<void> {
    await release();

    console.log(data);

    const s = codePointsToString(data);
    const outputElement = document.querySelector(this.outputSelector);
    if (outputElement) {
      outputElement.insertAdjacentText("beforeend", s);
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
  private wrapperElement: HTMLDivElement | null = null;
  private resolvablePromise?: ResolvablePromise<number[]>;

  public constructor(
    private readonly inputContainerSelector: string = "#input"
  ) {
    super();
  }

  private ensureUI(): void {
    // Already created.
    if (this.wrapperElement) {
      return;
    }

    const container = document.querySelector(this.inputContainerSelector);
    if (!container) {
      throw new Error(
        `container element not found: ${this.inputContainerSelector}`
      );
    }

    // Create wrapper with flex layout
    this.wrapperElement = document.createElement("div");
    this.wrapperElement.style.display = "flex";
    this.wrapperElement.style.marginBottom = "8px";
    this.wrapperElement.style.gap = "8px";

    // Create input element
    this.inputElement = document.createElement("input");
    this.inputElement.type = "text";
    this.inputElement.style.flex = "1";
    this.inputElement.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        this.submitInput();
      }
    });
    this.wrapperElement.appendChild(this.inputElement);

    // Create button element
    this.buttonElement = document.createElement("button");
    this.buttonElement.textContent = "Enter";
    this.buttonElement.addEventListener("click", () => {
      this.submitInput();
    });
    this.wrapperElement.appendChild(this.buttonElement);

    // Insert wrapper as the first child of the container.
    container.prepend(this.wrapperElement);
  }

  private submitInput(): void {
    if (!this.inputElement || !this.resolvablePromise) {
      return;
    }

    const text = this.inputElement.value;
    this.inputElement.value = "";

    const data = stringToCodePoints(text);
    this.resolvablePromise.resolve(data);
    this.resolvablePromise = undefined;
  }

  protected onRead(): Promise<number[]> {
    this.ensureUI();

    if (this.resolvablePromise) {
      this.resolvablePromise.reject("read while pending");
    }

    // Clear input when starting a new read
    if (this.inputElement) {
      this.inputElement.value = "";
      this.inputElement.focus();
    }

    this.resolvablePromise = new ResolvablePromise<number[]>();
    return this.resolvablePromise.promise;
  }
}

export { BrowserInputPeripheral, BrowserOutputPeripheral };

