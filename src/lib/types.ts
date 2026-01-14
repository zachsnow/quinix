import { stringToCodePoints } from "./util";

function formatNumber(
  n: number,
  bytes: number = 4,
  signed: boolean = false
): string {
  let sign = "";
  if (signed) {
    if (n < 0) {
      n = -n;
      sign = "-";
    }
  } else {
    n = n >>> 0;
  }

  return sign + "0x" + n.toString(16).padStart(bytes * 2, "0");
}

function parseNumber(s: string): number {
  s = s.trim();
  if (s.indexOf("0x") === 0) {
    return parseInt(s.substr(2), 16);
  }
  return parseInt(s, 10);
}

/**
 * Immediates are simple numeric values. Immediates may represent an `Address`, an `Offset`,
 * or any other number in the virtual machine.
 */
type Immediate = number;
namespace Immediate {
  export function toString(i: Immediate, bytes: number = 4): string {
    return formatNumber(i, bytes);
  }

  export function parse(s: string): Immediate {
    return parseNumber(s);
  }
}

/**
 * Addresses are *memory* addresses. If you have an `Address` you can index into `Memory`.
 */
type Address = number;
namespace Address {
  export function toString(address: Address, bytes: number = 4): string {
    return formatNumber(address, bytes);
  }

  export function parse(s: string): Address {
    return parseNumber(s);
  }
}

/**
 * Offsets represent *memory* offsets. So if you have an `Address`, you can
 * add an `Offset` to it to get another `Address`.
 */
type Offset = number;
namespace Offset {
  export function toString(offset: Offset, bytes: number = 2) {
    return formatNumber(offset, bytes);
  }
}

/**
 * Represents a contiguous region of virtual machine memory.
 */
class Memory extends Uint32Array {
  /**
   * Creates a view on this memory that allows reading and writing only within the
   * given range.
   *
   * @param offset the address of the beginning of the view, in virtual machine bytes.
   * @param length the length of the view, in virtual machine bytes.
   */
  public createView(offset: number, length: number): Memory {
    return new Memory(this.buffer, offset * Memory.BYTES_PER_ELEMENT, length);
  }

  /**
   * Returns the base address of this view.
   */
  public get base(): Address {
    return this.byteOffset / Memory.BYTES_PER_ELEMENT;
  }

  public toString() {
    const lines: string[] = [];
    this.forEach((n, i) => {
      const address = this.base + i;
      lines.push(`${Address.toString(address)}: ${Immediate.toString(n)}`);
    });
    return lines.join("\n");
  }

  /**
   * Converts this memory region to bytes.
   */
  public toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Converts the given bytes to memory.
   *
   * @param bytes the bytes to convert to memory.
   */
  public static fromBytes(bytes: Uint8Array): Memory {
    return new Memory(
      bytes.buffer as ArrayBuffer,
      bytes.byteOffset,
      bytes.byteLength / Memory.BYTES_PER_ELEMENT
    );
  }

  /**
   * Converts the given UTF-8 string to memory, codepoint by codepoint.
   *
   * @param text the string to convert to memory.
   */
  public static fromString(text: string): Memory {
    const codepoints = stringToCodePoints(text);
    const memory = new Memory(codepoints.length);
    codepoints.forEach((c, i) => {
      memory[i] = c;
    });
    return memory;
  }
}

export { Address, Immediate, Memory, Offset };
