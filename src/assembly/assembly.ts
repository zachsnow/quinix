import { Address } from "@/lib/types";
import {
  Messages,
  SymbolTable,
  Syntax,
  parseFile,
  stringToCodePoints,
} from "@/lib/util";
import {
  Immediate,
  Instruction,
  Operation,
  Program,
  Register,
} from "@/vm/instructions";
import { VM } from "@/vm/vm";
import { parse } from "./parser";

class Assembler extends Messages {
  public readonly programSectionBase = VM.PROGRAM_ADDR;
  public readonly addressTable: AddressTable = new AddressTable();
}

/**
 * A reference introduced by label or data directive, and used by a constant
 * directives. References must be unique across a program.
 *
 * References take 2 forms, unquoted (@some_qualified::label) and
 * quoted (@`some label that can contain anything!`).
 */
class Reference {
  private static QUALIFIED_IDENTIFIER_REGEX =
    /^[a-zA-Z_][a-zA-Z_0-9\$]*(::[a-zA-Z_][a-zA-Z_0-9\$]*)*$/;

  public constructor(
    /**
     * The name of the reference.
     */
    private readonly name: string
  ) { }

  public preassemble(assembler: Assembler, ip: Address): void {
    assembler.addressTable.set(this.name, ip);
  }

  public assemble(assembler: Assembler): Instruction[] | undefined {
    if (!assembler.addressTable.has(this.name)) {
      return;
    }

    // Relocate reference.
    const address = assembler.addressTable.get(this.name).value;
    return [
      Instruction.createImmediate(address + assembler.programSectionBase),
    ];
  }

  public toString() {
    // Try to output "nice", unquoted references.
    if (!Reference.QUALIFIED_IDENTIFIER_REGEX.exec(this.name)) {
      return "@`" + this.name + "`";
    }
    return `@${this.name}`;
  }
}

/**
 * Base class for directives.
 */
abstract class Directive extends Syntax {
  private _comment: string = "";

  /**
   * A first pass over directives that constructs a table mapping
   * labels to addresses.
   *
   * @param addressTable the address table being constructed.
   * @param ip the address that the directive is being assembled at.
   */
  public preassemble(assembler: Assembler, ip: Address): void { }

  /**
   * Assembles the directive to a list of instructions.
   *
   * @param addressTable the address table to use to locate labels.
   */
  public abstract assemble(assembler: Assembler): Instruction[];

  /**
   * The number of bytes the directive will take in the binary.
   */
  public get size() {
    return 1;
  }

  /**
   * Given a bit of text, annotates it with a trailing `;`-prefixed
   * comment. Does some padding to make it look cute.
   *
   * @param text the text to annotate.
   */
  protected withComment(text: string) {
    if (!this._comment) {
      return text;
    }
    const characters = 72 - text.length;
    const space =
      characters > 0 ? new Array(72 - text.length).fill(" ").join("") : " ";
    return `${text}${space}; ${this._comment}`;
  }

  /**
   * Annotates the directive with the given comment text.
   *
   * @param text the text to attach as a comment.
   *
   * @remark While directives can be annoted and rendered with a comment
   * for convenience, in general these annotations are only introduced when
   * *generating* an assembly program, as opposed to when parsing one.

   */
  public comment(text: string) {
    this._comment = this._comment ? `${text} -- ${this._comment}` : text;
    return this;
  }

  public abstract toString(): string;
}

/**
 * Base class for data associated with a `data` directive.
 */
abstract class Data extends Syntax {
  public abstract assemble(assembler: Assembler): Instruction[];

  public get size() {
    return 1;
  }
}

/**
 * Represents a string literal that is to be assembled directly
 * into the program.
 */
class TextData extends Data {
  private text: string;
  private codePoints: number[];

  public constructor(text: string) {
    super();
    this.text = text;
    this.codePoints = stringToCodePoints(this.text);
  }

  public toString() {
    return `'${TextData.escape(this.text)}'`;
  }

  public get size() {
    // Strings are prefixed by their length in codepoints.
    return this.codePoints.length + 1;
  }

  public assemble(assembler: Assembler): Instruction[] {
    // String literals are assembled as their length followed by
    // their codepoints. They are *not* zero terminated (Pascal strings).
    const instructions: Instruction[] = [];
    instructions.push(Instruction.createImmediate(this.codePoints.length));
    for (let i = 0; i < this.codePoints.length; i++) {
      instructions.push(Instruction.createImmediate(this.codePoints[i]));
    }
    return instructions;
  }

  /**
   * Returns an escaped version of the given string, suitable
   * for use in an assembly program's text.
   *
   * @param s the string to escape.
   */
  public static escape(s: string): string {
    const replacements = [
      ["\\", "\\\\"],
      ["'", "\\'"],
      ["\n", "\\n"],
    ];
    return replacements.reduce((s, [c, r]) => {
      return s.replace(c, r);
    }, s);
  }
}

/**
 * Represents one or more immediate values to be assembled
 * directly into the program.
 */
class ImmediatesData extends Data {
  private immediates: number[];
  public constructor(immediates: number[]) {
    super();
    this.immediates = immediates;
  }

  public assemble(assembler: Assembler): Instruction[] {
    return this.immediates.map((immediate) => {
      return Instruction.createImmediate(immediate);
    });
  }

  public get size() {
    return this.immediates.length;
  }

  public toString() {
    return this.immediates.map((i) => Immediate.toString(i, 1)).join(" ");
  }
}

/**
 * Represents an address (referred to by name, to be replaced
 * by the actual address during assembly) to be assembled directly
 * into the program.
 */
class ReferenceData extends Data {
  private readonly reference: Reference;
  public constructor(reference: Reference) {
    super();
    this.reference = reference;
  }

  public assemble(assembler: Assembler): Instruction[] {
    const instructions = this.reference.assemble(assembler);
    if (instructions === undefined) {
      this.error(assembler, `unknown reference ${this.reference}`);
      return [];
    }
    return instructions;
  }

  public toString() {
    return this.reference.toString();
  }
}

/**
 * A data declaration of one of the following forms:
 *
 *    data @reference 0xNNNNNNNN ... 0xNNNNNNNN -- an `ImmediatesData` declaration.
 *    data @reference 'Literal' -- a `TextData` declaration.
 *    data @reference @address -- a `ReferenceData` declaration.
 */
class DataDirective extends Directive {
  private readonly reference: Reference;
  private readonly data: Data;

  public constructor(reference: Reference, data: Data) {
    super();
    this.reference = reference;
    this.data = data;
  }

  public preassemble(assembler: Assembler, ip: Address): void {
    this.reference.preassemble(assembler, ip);
  }

  public assemble(assembler: Assembler): Instruction[] {
    return this.data.assemble(assembler);
  }

  public toString(): string {
    return this.withComment(`data ${this.reference} ${this.data}`);
  }

  public get size() {
    return this.data.size;
  }
}

/**
 * Base class for constants associated with a `constant` directive.
 */
abstract class Constant extends Syntax {
  public abstract assemble(assembler: Assembler): Instruction[];
}

/**
 * An immediate constant.
 */
class ImmediateConstant extends Constant {
  private readonly immediate: Immediate;

  public constructor(immediate: Immediate) {
    super();
    this.immediate = immediate;
  }

  public assemble(assembler: Assembler): Instruction[] {
    return [Instruction.createImmediate(this.immediate)];
  }

  public toString() {
    return Immediate.toString(this.immediate, 2);
  }
}

/**
 * A reference constant.
 */
class ReferenceConstant extends Constant {
  private readonly reference: Reference;

  public constructor(reference: Reference) {
    super();
    this.reference = reference;
  }

  public assemble(assembler: Assembler): Instruction[] {
    const instructions = this.reference.assemble(assembler);
    if (instructions === undefined) {
      this.error(assembler, `unknown reference ${this.reference}`);
      return [];
    }
    return instructions;
  }

  public toString() {
    return this.reference.toString();
  }
}

/**
 * A constant of one of the following forms:
 *
 *    constant dr 0xNNNNNNNN -- an `ImmediateConstant`.
 *    constant dr @reference -- a `ReferenceConstant`.
 */
class ConstantDirective extends Directive {
  public dr: Register;
  public constant: Constant;

  public constructor(dr: Register, constant: Constant) {
    super();
    this.dr = dr;
    this.constant = constant;
  }

  public assemble(assembler: Assembler): Instruction[] {
    return [
      Instruction.createOperation(Operation.CONSTANT, this.dr),
      ...this.constant.assemble(assembler),
    ];
  }

  public toString(): string {
    return this.withComment(
      `constant ${Register.toString(this.dr)} ${this.constant}`
    );
  }

  public get size(): number {
    // Constants consist of the `constant` instruction followed
    // by a single immediate, for 2 bytes total.
    return 2;
  }
}

/**
 * A label of the form `@some_label:`.
 */
class LabelDirective extends Directive {
  private reference: Reference;

  public constructor(reference: Reference) {
    super();
    this.reference = reference;
  }

  public preassemble(assembler: Assembler, ip: Address): void {
    this.reference.preassemble(assembler, ip);
  }

  public assemble(assembler: Assembler): Instruction[] {
    return [];
  }

  public toString(): string {
    return this.withComment(`${this.reference}:`);
  }

  public get size() {
    return 0;
  }
}

/**
 * A normal assembly instruction.
 */
class InstructionDirective extends Directive {
  private instruction: Instruction;

  public constructor(instruction: Instruction) {
    super();
    this.instruction = instruction;
  }

  public assemble(assembler: Assembler): Instruction[] {
    return [this.instruction];
  }

  public toString() {
    return this.withComment(this.instruction.toString());
  }
}

/**
 * A table mapping labels to their address in the final binary.
 */
class AddressTable extends SymbolTable<Address> { }

class AssemblyProgram {
  public directives: Directive[] = [];

  public constructor(directives: Directive[]) {
    this.directives = directives;
  }

  public toString(annotate: boolean = false): string {
    if (annotate) {
      let address = VM.PROGRAM_ADDR;
      this.directives.forEach((d) => {
        d.comment(Address.toString(address, 2));
        address += d.size;
      });
    }

    return this.directives.join("\n");
  }

  /**
   * Outputs the directives in their textual form; once we have sections,
   * this will actually be useful. For now it's a hack that assumes
   * that code is in the right order and we can just pull the data
   * out to the end of the program.
   *
   * In particular, this will break if there are QLL globals with non-constant
   * initializers.
   */
  public toAssembly(): string {
    const data = this.directives
      .map((directive) =>
        directive instanceof DataDirective ? directive : null
      )
      .filter((directive): directive is DataDirective => !!directive);

    const directives = this.directives.filter((directive) => {
      return !(directive instanceof DataDirective);
    });

    return [...directives, ...data].join("\n");
  }

  /**
   * Assembles the directives in the program and returns a
   * binary `Program`.
   */
  public assemble(): [Messages, Program | undefined] {
    // We'll put all of the data after the code, so split them out.
    const data = this.directives
      .map((directive) =>
        directive instanceof DataDirective ? directive : null
      )
      .filter((directive): directive is DataDirective => !!directive);

    const directives = this.directives.filter((directive) => {
      return !(directive instanceof DataDirective);
    });

    // Emit 2 halts; sentinal used to aid in decoding for now.
    directives.push(
      new InstructionDirective(Instruction.createOperation(Operation.HALT)),
      new InstructionDirective(Instruction.createOperation(Operation.HALT))
    );

    // Pre-assemble to collect addresses of labels and data.
    const assembler = new Assembler();
    let ip = 0;

    // Find the location of all of the labels.
    directives.forEach((directive) => {
      directive.preassemble(assembler, ip);
      ip += directive.size;
    });

    // Add all of the data.
    data.forEach((directive) => {
      directive.preassemble(assembler, ip);
      ip += directive.size;
    });

    // Emit instructions.
    const instructions: Instruction[] = [];
    directives.forEach((directive) => {
      instructions.push(...directive.assemble(assembler));
    });

    // Emit data.
    data.forEach((directive) => {
      instructions.push(...directive.assemble(assembler));
    });

    // Emit sentinel; these come after the program so we don't need to worry
    // about affecting addresses.
    instructions.push(Instruction.createOperation(Operation.HALT));
    instructions.push(Instruction.createOperation(Operation.HALT));

    // If we have errors, the program isn't actually valid.
    if (assembler.errors.length) {
      return [assembler, undefined];
    }

    return [assembler, new Program(instructions)];
  }

  /**
   * Concatenates the given assembly programs into a single assembly program.
   *
   * @param assemblyPrograms the programs to concatenate.
   */
  public static concat(assemblyPrograms: AssemblyProgram[]): AssemblyProgram {
    const directives: Directive[] = [];
    assemblyPrograms.forEach((assemblyProgram) => {
      directives.push(...assemblyProgram.directives);
    });
    return new AssemblyProgram(directives);
  }

  /**
   * Parses the given program text into an assembly program.
   *
   * @param programText the program text to assemble.
   * @param filename the filename of the source of the program text.
   */
  public static parse(programText: string, filename?: string): AssemblyProgram {
    return parseFile(parse, programText, filename);
  }
}

export {
  AddressTable,
  Assembler,
  AssemblyProgram, ConstantDirective, DataDirective, Directive, ImmediateConstant, ImmediatesData, InstructionDirective,
  LabelDirective,
  Reference, ReferenceConstant, ReferenceData, TextData
};

