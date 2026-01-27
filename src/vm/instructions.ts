import { Immediate, Memory } from "@/lib/types";

/**
 * A virtual machine operation.
 */
enum Operation {
  HALT = 0,

  INT,

  LOAD,
  STORE,
  MOV,

  CONSTANT,

  ADD,
  SUB,
  MUL,
  DIV,
  MOD,

  AND,
  OR,
  NOT,
  SHL,
  SHR,

  EQ,
  NEQ,
  LT,
  GT,

  JMP,
  JZ,
  JNZ,

  NOP,

  WAIT,

  // Floating point arithmetic
  FADD,
  FSUB,
  FMUL,
  FDIV,

  // Floating point comparison
  FEQ,
  FLT,
  FGT,

  // Floating point conversion
  ITOF,
  UTOF,
  FTOI,
}

namespace Operation {
  export type Specification = {
    name: string;
    d: boolean;
    s0: boolean;
    s1: boolean;
  };

  export const specifications: Specification[] = [
    "halt",
    "int s",
    "load d s",
    "store d s",
    "mov d s",
    "constant d",
    "add d s s",
    "sub d s s",
    "mul d s s",
    "div d s s",
    "mod d s s",
    "and d s s",
    "or d s s",
    "not d s",
    "shl d s s",
    "shr d s s",
    "eq d s s",
    "neq d s s",
    "lt d s s",
    "gt d s s",
    "jmp s",
    "jz s s",
    "jnz s s",
    "nop",
    "wait",
    "fadd d s s",
    "fsub d s s",
    "fmul d s s",
    "fdiv d s s",
    "feq d s s",
    "flt d s s",
    "fgt d s s",
    "itof d s",
    "utof d s",
    "ftoi d s",
  ].map((spec) => {
    const parts = spec.split(" ");
    const name = parts[0];
    const i = parts.indexOf("s");
    return {
      name,
      d: parts[1] === "d",
      s0: i !== -1,
      s1: parts.indexOf("s", i + 1) !== -1,
    };
  });

  export function toString(operation: Operation): string {
    return Operation.specifications[operation].name;
  }

  /**
   * Checks whether the given number is represents an operation,
   * or is out of range.
   *
   * @param n the operation
   */
  export function isValid(n: number): boolean {
    return n >= Operation.HALT && n < Operation.specifications.length;
  }
}

/**
 * Represents the internal "name" of a virtual machine register.
 */
type Register = number;

namespace Register {
  export const GENERIC_REGISTER_COUNT = 64;

  /**
   * The display names of all the generic registers of the virtual machine.
   */
  export const genericRegisters = new Array<string>(GENERIC_REGISTER_COUNT)
    .fill("r")
    .map((r, i) => {
      return r + i.toString(10);
    });

  /**
   * The display names of the special registers of the virtual machine.
   */

  export const specialRegisters = ["ip"];

  /**
   * The display names of all the registers of the virtual machine.
   */
  export const registers: string[] = [...genericRegisters, ...specialRegisters];

  /**
   * The total number of generic and special registers.
   */
  export const REGISTER_COUNT = registers.length;

  /**
   * Parses the given string into a register; throws if the string does not
   * represent a valid generic or special register.
   *
   * @param s the string to parse.
   */
  export function parse(s: string): Register {
    var index = registers.indexOf(s);
    if (index !== -1) {
      return index;
    }
    throw new Error("invalid register");
  }

  export function toString(r: Register): string {
    const s = registers[r];
    if (s !== undefined) {
      return s;
    }
    throw new Error("invalid register");
  }

  export const R0 = 0;
  export const R1 = 1;

  export const IP = REGISTER_COUNT - 1;
}

class Instruction {
  public operation: Operation = Operation.HALT;
  public dr?: Register;
  public sr0?: Register;
  public sr1?: Register;
  public immediate?: number;

  public toString() {
    if (this.immediate !== undefined) {
      return Immediate.toString(this.immediate);
    }

    const specification = Operation.specifications[this.operation];

    const parts = [
      Operation.toString(this.operation),
      specification.d ? Register.toString(this.dr!) : "",
      specification.s0 ? Register.toString(this.sr0!) : "",
      specification.s1 ? Register.toString(this.sr1!) : "",
    ].filter((part) => !!part);

    return parts.join(" ");
  }

  public encode(): number {
    // Immediates are just their own value.
    if (this.immediate !== undefined) {
      return this.immediate >>> 0;
    }

    // Otherwise, encode the instruction.
    return (
      (this.operation << 24) |
      ((this.dr || 0) << 16) |
      ((this.sr0 || 0) << 8) |
      ((this.sr1 || 0) << 0)
    );
  }

  public static decode(u32: number): Instruction {
    const instruction = new Instruction();

    u32 = u32 & 0xffffffff;

    const operation = (u32 >>> 24) & 0xff;

    if (!Operation.isValid(operation)) {
      instruction.immediate = u32;
      return instruction;
    }

    instruction.operation = operation;
    instruction.dr = (u32 >>> 16) & 0xff;
    instruction.sr0 = (u32 >>> 8) & 0xff;
    instruction.sr1 = (u32 >>> 0) & 0xff;
    return instruction;
  }

  public static createOperation(
    operation: Operation,
    dr?: Register,
    sr0?: Register,
    sr1?: Register
  ) {
    const instruction = new Instruction();

    const specification = Operation.specifications[operation];
    if (!specification) {
      throw new Error();
    }
    instruction.operation = operation;

    if (specification.d && dr === undefined) {
      throw new Error(
        `${Operation.toString(operation)}: missing destination register`
      );
    }
    instruction.dr = dr;

    if (specification.s0 && sr0 === undefined) {
      throw new Error(
        `${Operation.toString(operation)}: missing first source register`
      );
    }
    instruction.sr0 = sr0;

    if (specification.s1 && sr1 === undefined) {
      throw new Error(
        `${Operation.toString(operation)}: missing second source register`
      );
    }
    instruction.sr1 = sr1;

    return instruction;
  }

  public static createImmediate(u32: number) {
    u32 = u32 & 0xffffffff;

    const instruction = new Instruction();
    instruction.immediate = u32;

    return instruction;
  }
}

class Program {
  public readonly instructions: Instruction[] = [];

  public constructor(instructions: Instruction[]) {
    this.instructions = instructions;
  }

  public toString(baseAddress: number = 0): string {
    return this.instructions
      .map((instruction, i) => {
        return (
          Immediate.toString(baseAddress + i) + ": " + instruction.toString()
        );
      })
      .join("\n");
  }

  public encode(): Memory {
    const output = new Memory(this.instructions.length);
    this.instructions.forEach((instruction, i) => {
      output[i] = instruction.encode();
    });
    return output;
  }

  public static decode(u32s: Uint32Array): Program {
    const instructions: Instruction[] = [];

    let isConstant = false;
    let haltCount = 0;
    u32s.forEach((u32) => {
      if (isConstant) {
        isConstant = false;
        instructions.push(Instruction.createImmediate(u32));
        haltCount = 0;
      } else if (haltCount > 1) {
        instructions.push(Instruction.createImmediate(u32));
      } else {
        const instruction = Instruction.decode(u32);
        haltCount += instruction.operation === Operation.HALT ? 1 : 0;
        isConstant = instruction.operation === Operation.CONSTANT;
        instructions.push(instruction);
      }
    });

    return new Program(instructions);
  }
}

export { Immediate, Instruction, Operation, Program, Register };

