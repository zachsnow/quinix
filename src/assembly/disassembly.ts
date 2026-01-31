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
  private codeEnd: number = 0;        // End of user code (before boundary halts)
  private dataSectionStart: number = 0; // Start of data section (after boundary halts)
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
   * After 2 consecutive halts, treat remaining words as data (immediates).
   */
  private decodeInstructions(): void {
    let expectImmediate = false;
    let consecutiveHalts = 0;
    let inDataSection = false;

    for (let i = 0; i < this.words.length; i++) {
      const word = this.words[i];

      // After 2 consecutive halts, everything is data
      if (inDataSection) {
        this.instructions.push(Instruction.createImmediate(word));
        this.isImmediate.push(true);
        continue;
      }

      if (expectImmediate) {
        this.instructions.push(Instruction.createImmediate(word));
        this.isImmediate.push(true);
        expectImmediate = false;
        consecutiveHalts = 0;
        continue;
      }

      const instruction = Instruction.decode(word);
      this.instructions.push(instruction);
      this.isImmediate.push(instruction.immediate !== undefined);

      if (instruction.operation === Operation.CONSTANT) {
        expectImmediate = true;
        consecutiveHalts = 0;
      } else if (instruction.immediate === undefined && instruction.operation === Operation.HALT) {
        consecutiveHalts++;
        if (consecutiveHalts >= 2) {
          inDataSection = true;
        }
      } else {
        consecutiveHalts = 0;
      }
    }
  }

  /**
   * Find the boundary between code and data sections.
   *
   * The assembler adds 2 boundary halts after code and 2 trailing halts after data.
   * When there's no data, we get 4 consecutive halts at the end.
   *
   * Strategy:
   * 1. Strip exactly 2 trailing halts from the very end
   * 2. Find 2 consecutive halts for the boundary
   * 3. Keep any user halts before the boundary
   */
  private findCodeBoundary(): void {
    // Strip exactly 2 trailing halts from the end (the assembler always adds 2)
    // Check both actual HALT instructions and immediate 0 values (which encode the same)
    let effectiveEnd = this.instructions.length;
    let trailingHaltsStripped = 0;
    while (effectiveEnd > 0 && trailingHaltsStripped < 2) {
      const inst = this.instructions[effectiveEnd - 1];
      const isTrailingHalt = (inst.immediate === undefined && inst.operation === Operation.HALT) ||
        (inst.immediate === 0);
      if (isTrailingHalt) {
        effectiveEnd--;
        trailingHaltsStripped++;
      } else {
        break;
      }
    }

    // Now scan forward for 2+ consecutive halts (the boundary sentinels)
    // Check both actual HALT instructions and immediate 0 values
    let consecutiveHalts = 0;
    let firstHaltIndex = -1;
    let consecutiveBad = 0;

    for (let i = 0; i < effectiveEnd; i++) {
      const inst = this.instructions[i];
      const isHalt = (inst.immediate === undefined && inst.operation === Operation.HALT) ||
        (inst.immediate === 0);

      // Track consecutive halts
      if (isHalt) {
        if (consecutiveHalts === 0) {
          firstHaltIndex = i;
        }
        consecutiveHalts++;
      } else {
        // End of halt sequence - check if we found the boundary (need 2+)
        if (consecutiveHalts >= 2) {
          // Skip only the last 2 halts (boundary sentinels), keep any user halts before
          const boundaryStart = firstHaltIndex + consecutiveHalts - 2;
          this.codeEnd = boundaryStart;
          this.dataSectionStart = firstHaltIndex + consecutiveHalts;
          return;
        }
        consecutiveHalts = 0;
        firstHaltIndex = -1;
      }

      // Check for bad instructions (invalid opcode or registers)
      if (this.isBadInstruction(inst)) {
        consecutiveBad++;
        if (consecutiveBad >= 3) {
          this.codeEnd = i - 2;
          this.dataSectionStart = i - 2;
          return;
        }
      } else {
        consecutiveBad = 0;
      }
    }

    // Check if effectiveEnd ends with 2+ halts (boundary with no data after)
    if (consecutiveHalts >= 2) {
      const boundaryStart = firstHaltIndex + consecutiveHalts - 2;
      this.codeEnd = boundaryStart;
      this.dataSectionStart = firstHaltIndex + consecutiveHalts;
      return;
    }

    // No boundary halts found - emit everything up to effectiveEnd
    this.codeEnd = effectiveEnd;
    this.dataSectionStart = effectiveEnd;
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
    for (let i = 0; i < this.codeEnd - 1; i++) {
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
      if (index < this.codeEnd) {
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

    // Emit code section (excluding boundary halts - assembler will add them)
    let i = 0;
    while (i < this.codeEnd) {
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
    while (dataEnd > this.dataSectionStart) {
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
    i = this.dataSectionStart;
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
