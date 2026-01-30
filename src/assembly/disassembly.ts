import { Address, Immediate, Memory } from "@/lib/types";
import { Instruction, Operation, Register } from "@/vm/instructions";

const PROGRAM_BASE = 0x1000;

/**
 * Disassembles a binary program back to QASM assembly.
 */
class Disassembler {
  private readonly words: Uint32Array;
  private readonly instructions: Instruction[] = [];
  private readonly isImmediate: boolean[] = [];
  private codeBoundary: number = 0;
  private readonly codeLabels: Map<number, string> = new Map();
  private readonly dataLabels: Map<number, string> = new Map();

  public constructor(words: Uint32Array) {
    this.words = words;
  }

  /**
   * Disassembles the binary and returns QASM text.
   */
  public disassemble(): string {
    this.decodeInstructions();
    this.findCodeBoundary();
    this.collectLabels();
    return this.emit();
  }

  /**
   * First pass: decode all words into instructions, tracking which are immediates.
   */
  private decodeInstructions(): void {
    let expectImmediate = false;

    for (let i = 0; i < this.words.length; i++) {
      const word = this.words[i];

      if (expectImmediate) {
        this.instructions.push(Instruction.createImmediate(word));
        this.isImmediate.push(true);
        expectImmediate = false;
        continue;
      }

      const instruction = Instruction.decode(word);
      this.instructions.push(instruction);
      this.isImmediate.push(instruction.immediate !== undefined);

      if (instruction.operation === Operation.CONSTANT) {
        expectImmediate = true;
      }
    }
  }

  /**
   * Find the boundary between code and data sections.
   * Primary: 2 consecutive halts.
   * Fallback: 3+ consecutive bad instructions.
   */
  private findCodeBoundary(): void {
    let consecutiveHalts = 0;
    let consecutiveBad = 0;

    for (let i = 0; i < this.instructions.length; i++) {
      const inst = this.instructions[i];

      // Check for 2 consecutive halts
      if (inst.immediate === undefined && inst.operation === Operation.HALT) {
        consecutiveHalts++;
        if (consecutiveHalts >= 2) {
          // Boundary is after the second halt
          this.codeBoundary = i + 1;
          return;
        }
      } else {
        consecutiveHalts = 0;
      }

      // Check for bad instructions (invalid opcode or registers)
      if (this.isBadInstruction(inst)) {
        consecutiveBad++;
        if (consecutiveBad >= 3) {
          // Boundary is where the bad instructions started
          this.codeBoundary = i - 2;
          return;
        }
      } else {
        consecutiveBad = 0;
      }
    }

    // No clear boundary found - treat everything as code
    this.codeBoundary = this.instructions.length;
  }

  /**
   * Checks if an instruction looks invalid (likely data misinterpreted as code).
   */
  private isBadInstruction(inst: Instruction): boolean {
    if (inst.immediate !== undefined) {
      return false;
    }

    // Invalid opcode
    if (!Operation.isValid(inst.operation)) {
      return true;
    }

    // Invalid register numbers
    const maxReg = Register.REGISTER_COUNT;
    if (inst.dr !== undefined && inst.dr >= maxReg) {
      return true;
    }
    if (inst.sr0 !== undefined && inst.sr0 >= maxReg) {
      return true;
    }
    if (inst.sr1 !== undefined && inst.sr1 >= maxReg) {
      return true;
    }

    return false;
  }

  /**
   * Collect all addresses referenced by constant instructions and assign labels.
   */
  private collectLabels(): void {
    const referencedAddresses: Set<number> = new Set();

    // Find all constant instructions and collect their immediate values
    for (let i = 0; i < this.codeBoundary - 1; i++) {
      const inst = this.instructions[i];
      if (inst.immediate === undefined && inst.operation === Operation.CONSTANT) {
        const nextInst = this.instructions[i + 1];
        if (nextInst?.immediate !== undefined) {
          const addr = nextInst.immediate;
          // Check if this looks like a program address
          if (addr >= PROGRAM_BASE && addr < PROGRAM_BASE + this.words.length) {
            referencedAddresses.add(addr);
          }
        }
      }
    }

    // Assign labels based on whether address is in code or data section
    const codeAddrs: number[] = [];
    const dataAddrs: number[] = [];

    for (const addr of referencedAddresses) {
      const index = addr - PROGRAM_BASE;
      if (index < this.codeBoundary) {
        codeAddrs.push(addr);
      } else {
        dataAddrs.push(addr);
      }
    }

    // Sort and assign labels
    codeAddrs.sort((a, b) => a - b);
    dataAddrs.sort((a, b) => a - b);

    codeAddrs.forEach((addr, i) => {
      this.codeLabels.set(addr, `@L${i}`);
    });

    dataAddrs.forEach((addr, i) => {
      this.dataLabels.set(addr, `@D${i}`);
    });
  }

  /**
   * Emit the QASM output.
   */
  private emit(): string {
    const lines: string[] = [];

    // Emit code section
    let i = 0;
    while (i < this.codeBoundary) {
      const addr = PROGRAM_BASE + i;
      const inst = this.instructions[i];

      // Emit label if this address has one
      const label = this.codeLabels.get(addr);
      if (label) {
        lines.push(this.formatLine(`${label}:`, addr));
      }

      // Handle constant instruction: merge with following immediate
      if (inst.immediate === undefined && inst.operation === Operation.CONSTANT) {
        const nextInst = this.instructions[i + 1];
        const immValue = nextInst?.immediate;
        const immLabel = immValue !== undefined
          ? (this.codeLabels.get(immValue) || this.dataLabels.get(immValue))
          : undefined;
        const valueStr = immLabel || Immediate.toString(immValue ?? 0);
        lines.push(this.formatLine(`constant ${Register.toString(inst.dr!)} ${valueStr}`, addr));
        i += 2; // Skip both constant and immediate
        continue;
      }

      // Regular instruction
      lines.push(this.formatLine(inst.toString(), addr));
      i++;
    }

    // Find end of data section (exclude trailing halt sentinels)
    let dataEnd = this.instructions.length;
    while (dataEnd > this.codeBoundary) {
      const inst = this.instructions[dataEnd - 1];
      const value = inst.immediate ?? inst.encode();
      if (value === 0) {
        dataEnd--;
      } else {
        break;
      }
    }

    // Emit data section
    let nextUnreferencedLabel = 0;
    i = this.codeBoundary;
    while (i < dataEnd) {
      const addr = PROGRAM_BASE + i;
      let label = this.dataLabels.get(addr);
      if (!label) {
        // Generate unique label for unreferenced data
        while (this.dataLabels.has(PROGRAM_BASE + nextUnreferencedLabel) ||
               [...this.dataLabels.values()].includes(`@U${nextUnreferencedLabel}`)) {
          nextUnreferencedLabel++;
        }
        label = `@U${nextUnreferencedLabel}`;
        nextUnreferencedLabel++;
      }

      // Try to detect a string
      const stringResult = this.tryParseString(i);
      if (stringResult) {
        const [text, consumed] = stringResult;
        lines.push(this.formatLine(`data ${label} '${this.escapeString(text)}'`, addr));
        i += consumed;
        continue;
      }

      // Otherwise emit as immediate
      const inst = this.instructions[i];
      const value = inst.immediate ?? inst.encode();
      lines.push(this.formatLine(`data ${label} ${Immediate.toString(value)}`, addr));
      i++;
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Try to parse a string starting at the given index in the data section.
   * Returns [text, wordsConsumed] or undefined if not a valid string.
   */
  private tryParseString(startIndex: number): [string, number] | undefined {
    if (startIndex + 2 > this.instructions.length) {
      return undefined;
    }

    const capacityInst = this.instructions[startIndex];
    const lengthInst = this.instructions[startIndex + 1];

    const capacity = capacityInst.immediate ?? capacityInst.encode();
    const length = lengthInst.immediate ?? lengthInst.encode();

    // String literals have capacity == length
    if (capacity !== length) {
      return undefined;
    }

    // Sanity check: reasonable string length
    if (length === 0 || length > 10000) {
      return undefined;
    }

    // Check we have enough words
    if (startIndex + 2 + length > this.instructions.length) {
      return undefined;
    }

    // Check all codepoints are printable
    const codepoints: number[] = [];
    for (let i = 0; i < length; i++) {
      const inst = this.instructions[startIndex + 2 + i];
      const cp = inst.immediate ?? inst.encode();
      if (!this.isPrintable(cp)) {
        return undefined;
      }
      codepoints.push(cp);
    }

    const text = String.fromCodePoint(...codepoints);
    return [text, 2 + length];
  }

  /**
   * Check if a codepoint is printable (for string detection).
   */
  private isPrintable(cp: number): boolean {
    // Common ASCII printable range
    if (cp >= 0x20 && cp <= 0x7e) {
      return true;
    }
    // Common escape characters
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) { // tab, newline, carriage return
      return true;
    }
    return false;
  }

  /**
   * Escape a string for QASM output.
   */
  private escapeString(s: string): string {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");
  }

  /**
   * Format a line with an address comment.
   */
  private formatLine(text: string, addr: number): string {
    const addrComment = Address.toString(addr, 2);
    const padding = Math.max(1, 48 - text.length);
    return text + " ".repeat(padding) + "; " + addrComment;
  }
}

/**
 * Disassemble a binary to QASM.
 */
function disassemble(bytes: Uint8Array): string {
  const memory = Memory.fromBytes(bytes);
  const disassembler = new Disassembler(memory);
  return disassembler.disassemble();
}

export { Disassembler, disassemble };
