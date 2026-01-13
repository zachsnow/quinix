import { InternalError, unique, range } from '../lib/util';
import {
  Directive,
  ConstantDirective, ImmediateConstant, ReferenceConstant,
  DataDirective, ImmediatesData,
  InstructionDirective,
  LabelDirective,

  Reference,
} from '../assembly/assembly';
import { Register, Instruction, Operation, Immediate } from '../vm/instructions';
import { Storage } from './types';

class RegisterAllocator {
  private unallocatedCallerSave: Register[];
  private allocatedCallerSave: Register[] = [];
  private unallocatedCalleeSave: Register[];
  private allocatedCalleeSave: Register[] = [];
  private everAllocatedCalleeSave: Register[] = [];

  public constructor(){
    this.unallocatedCalleeSave = Array.from(Compiler.CalleeSaveRegisters);
    this.unallocatedCallerSave = Array.from(Compiler.CallerSaveRegisters);
  }

  /**
   * Returns callee-save registers that have ever been used.
   */
  public get calleeSave(): Register[] {
    this.everAllocatedCalleeSave.sort((a, b) => a - b);
    return unique(this.everAllocatedCalleeSave);
  }

  /**
   * Returns caller-save registers that are currently in use.
   */
  public get callerSave(): Register[] {
    this.allocatedCallerSave.sort((a, b) => a - b);
    return Array.from(this.allocatedCallerSave);
  }

  /**
   * Allocates and returns a fresh register. For now we'll prefer to allocate
   * out of the caller-save registers.
   */
  public allocate(): Register {
    this.unallocatedCallerSave.sort((a, b) => a - b);
    let r = this.unallocatedCallerSave.shift();
    if(r !== undefined){
      this.allocatedCallerSave.push(r);
      return r;
    }

    this.unallocatedCalleeSave.sort((a, b) => a - b);
    r = this.unallocatedCalleeSave.shift();
    if(r !== undefined){
      this.allocatedCalleeSave.push(r);
      this.everAllocatedCalleeSave.push(r);
      return r;
    }

    throw new InternalError(`ran out of registers`);
  }

  /**
   * Deallocates the given register.
   *
   * @param r the register to deallocate.
   */
  public deallocate(r: Register): void {
    let i = this.allocatedCallerSave.indexOf(r);
    if(i >= 0){
      this.allocatedCallerSave.splice(i, 1);
      this.unallocatedCallerSave.push(r);
      return;
    }

    i = this.allocatedCalleeSave.indexOf(r);
    if(i >= 0){
      this.allocatedCalleeSave.splice(i, 1);
      this.unallocatedCalleeSave.push(r);
      return;
    }

    throw new InternalError(`${r} not allocated`);
  }
}

type Parameter = {
  identifier: string;
  size: number;
}

type CallArgument = {
  register: Register;
  size: number;
  integral: boolean;
}

class Compiler {
  public static readonly NULL_ERROR = 0xe0000000;
  public static readonly BOUNDS_ERROR = 0xe0000001;
  public static readonly CAPACITY_ERROR = 0xe0000002;

  /**
   * Holds the stack pointer.
   */
  public static readonly SP = Register.genericRegisters.length - 1;

  /**
   * Holds the return-to address when calling, and the return value (for integral
   * types) when returning.
   */
  public static readonly RET = Register.R0;

  /**
   * Holds `1`.
   */
  public static readonly ONE = Register.genericRegisters.length - 2;

  /**
   * Generic registers that the compiler treats as "special", and that
   * should not be allocated / used by emitted code except in the relevant way.
   */
  public static readonly ReservedRegisters = [ Compiler.RET, Compiler.SP, Compiler.ONE ];

  public static readonly CallerSaveRegisters = range(1, Register.GENERIC_REGISTER_COUNT / 2);
  public static readonly CalleeSaveRegisters = range(
    Register.GENERIC_REGISTER_COUNT / 2,
    Register.GENERIC_REGISTER_COUNT - 2,
  );

  /**
   * The default memory allocator; implemented in `lib/system.qll`.
   */
  public static readonly DefaultAllocator = 'global::system::alloc'

  /**
   * The fully qualified identifier for the memory allocator.
   */
  private readonly allocator: string;

  /**
   * The default memory deallocator; implemented in `lib/system.qll`.
   */
  public static readonly DefaultDeallocator = 'global::system::dealloc';

  /**
   * The fully qualified identifier for the memory deallocator.
   */
  private readonly deallocator: string;

  /**
   * For label generation.
   */
  protected readonly prefix: string;
  private labels: number = 0;

  protected registers: RegisterAllocator = new RegisterAllocator();
  private directives: Directive[] = [];

  /**
   * For break statements; currently we don't have "named" breaks.
   */
  private breakReferences: Reference[] = [];
  public get breakReference(): Reference | undefined {
    return this.breakReferences[this.breakReferences.length - 1];
  }

  /**
   * @param prefix the name of the context being compiled -- e.g. a function's name.
   * @param allocator the custom allocator to use.
   * @param deallocator the custom deallocator to use.
   */
  public constructor(prefix: string, allocator: string = Compiler.DefaultAllocator, deallocator: string = Compiler.DefaultDeallocator){
    this.prefix = prefix;
    this.allocator = allocator;
    this.deallocator = deallocator;
  }

  /**
   * Evaluate the given `fn` with this compiler extended to include the given
   * break reference. (Kind of like "extending" this compiler but trying to avoid
   * cloning each private property and making it work with subclasses).
   *
   * @param reference the reference to break out to.
   * @param fn a function to evaluate in the context of this break label.
   */
  public loop(reference: Reference, fn: () => void): void {
    this.breakReferences.push(reference);
    try {
      fn();
    }
    finally {
      this.breakReferences.pop();
    }
  }

  /**
   * Generates and returns a fresh identifier in the current compiler context.
   *
   * @param hint a hint to include in the generated label.
   */
  public generateIdentifier(hint?: string): string {
    this.labels += 1;
    hint = hint ? `${hint}_` : '';
    return `${hint}${this.labels}`;
  }

  /**
   * Generates and returns a fresh label in the current compiler context.
   *
   * @param hint a hint to include in the generated label.
   */
  public generateReference(hint?: string): Reference {
    this.labels += 1;
    hint = hint ? `${hint}_` : '';
    return this.createReference(`${hint}${this.labels}`);
  }

  /**
   * Creates a reference with the given name in the current compiler context.
   *
   * @param name the name of the reference
   */
  public createReference(identifier: string): Reference {
    // Created labels have suffix `$` which means they cannot clash
    // with user-generated labels.w
    return new Reference(`${this.prefix}_${identifier}$`);
  }

  /**
   * Emits the given assembly directives.
   *
   * @param directives the assembly directives to emit.
   */
  public emit(directives: Directive[]) {
    this.directives.push(...directives);
  }

  /**
   * Allocates a fresh register.
   */
  public allocateRegister(): Register {
    return this.registers.allocate();
  }

  /**
   * Deallocates a register.
   *
   * @param r the register to deallocate.
   */
  public deallocateRegister(r: Register): void {
    return this.registers.deallocate(r);
  }

  /**
   * Compile the emitted block under the given reference.
   */
  public compile(): Directive[] {
    return [
      ...this.directives,
    ];
  }

  /**
   * Compiles a call to a function using the QLL calling convention. Returns the
   * register holding the return value. Note that the target and argument registers
   * *are* deallocated.
   *
   * @param argumentRegisters the registers holding the arguments to pass to the function.
   * @param target the register holding the address of the function body.
   */
  public emitCall(args: CallArgument[], target: Register, comment: string = ''): Register {
    const returnToRef = this.generateReference();

    // Push caller-save registers; skip pushing those that hold the target
    // or the arguments, since we will push and deallocate those separately.
    const callerSave = this.registers.callerSave.filter((r) => {
      if(r === target){
        return false;
      }
      return !args.find((arg) => {
        return arg.register === r;
      });
    });
    callerSave.forEach((r) => {
      this.emitPush(r, 'push caller-save register');
    });

    // Push arguments and deallocate them.
    let argSize = 0;
    args.forEach((arg) => {
      if(arg.integral){
        this.emitPush(arg.register, 'push argument');
      }
      else {
        this.emitPushMany(arg.size, 'allocate argument storage');
        const r = this.allocateRegister();
        this.emitMove(r, Compiler.SP);
        this.emitStaticCopy(r, arg.register, arg.size, 'store argument');
        this.deallocateRegister(r);
      }

      argSize += arg.size;
    });

    // Emit call.
    this.emit([
      // Set up return-to address.
      new ConstantDirective(Compiler.RET, new ReferenceConstant(returnToRef)).comment('set up return address'),

      // Call.
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, target)).comment(comment),

      // Return-to label.
      new LabelDirective(returnToRef).comment('return address'),
    ]);

    // Save the return value.
    const dr = this.allocateRegister();
    this.emitMove(dr, Compiler.RET);

    // Deallocate target so that popping can use it.
    this.deallocateRegister(target);

    // Pop all of the arguments.
    this.emitPopMany(argSize, 'pop arguments');

    // Pop caller-save registers.
    callerSave.reverse();
    callerSave.forEach((r) => {
      this.emitPop(r, 'pop caller-save register');
    });

    return dr;
  }

  /**
   * Emits a call to the memory allocator; returns the register holding
   * the new pointer.
   *
   * @param sr the register containing the number of bytes to allocate.
   * This register is deallocated after use.
   */
  public emitNew(sr: Register, comment: string = ''): Register {
    const reference = new Reference(this.allocator);
    const tr = this.allocateRegister();
    this.emit([
      new ConstantDirective(tr, new ReferenceConstant(reference)).comment('allocator'),
    ]);

    return this.emitCall([{ register: sr, size: 1, integral: true }], tr, comment);
  }

  /**
   * Emits a call to the memory deallocator.
   *
   * @param sr the register containing the pointer to deallocate.
   */
  public emitDelete(sr: Register, comment: string = ''): Register {
    const reference = new Reference(this.deallocator);
    const tr = this.allocateRegister();
    this.emit([
      new ConstantDirective(tr, new ReferenceConstant(reference)).comment('deallocator'),
    ]);
    return this.emitCall([{ register: sr, size: 1, integral: true }], tr, comment);
  }

  protected emitPush(r: Register, comment: string = ''): void {
    this.emit(this.push(r, comment));
  }

  // SP starts at the top of memory.
  protected push(r: Register, comment: string = ''): Directive[] {
    const directives = [
      new InstructionDirective(Instruction.createOperation(Operation.SUB, Compiler.SP, Compiler.SP, Compiler.ONE)).comment(comment),
      new InstructionDirective(Instruction.createOperation(Operation.STORE, Compiler.SP, r)),
    ];

    return directives;
  }

  /**
   * Stores the most recently pushed stack value in the given register.
   *
   * @param r the register to store to.
   * @param comment optional comment.
   */
  protected emitPeek(r: Register, comment: string = ''): void {
    this.emit([
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, r, Compiler.SP)).comment(comment),
    ]);
  }

  protected emitPop(r: Register, comment: string = ''): void {
    this.emit(this.pop(r, comment));
  }

  protected pop(r: Register, comment: string = ''): Directive[] {
    // Pop the stack into the given register.
    return [
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, r, Compiler.SP)).comment(comment),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, Compiler.SP, Compiler.SP, Compiler.ONE)),
    ];
  }

  protected emitPopMany(n: number, comment: string = ''): void {
    this.emitIncrement(Compiler.SP, n, comment);
  }

  protected emitPushMany(n: number, comment: string = ''): void {
    this.emit(this.pushMany(n));
  }

  protected pushMany(n: number, comment: string = ''): Directive[] {
    if(!n){
      return [];
    }
    else if(n === 1){
      return [
        new InstructionDirective(Instruction.createOperation(Operation.SUB, Compiler.SP, Compiler.SP, Compiler.ONE)).comment(comment),
      ];
    }
    else {
      const rn = this.allocateRegister();
      const directives: Directive[] = [
        new ConstantDirective(rn, new ImmediateConstant(n)).comment(comment),
        new InstructionDirective(Instruction.createOperation(Operation.SUB, Compiler.SP, Compiler.SP, rn))
      ];
      this.deallocateRegister(rn);
      return directives;
    }
  }

  /**
   * Emits a `MOV` from `sr` to `dr`. Avoids unnecessary moves.
   *
   * @param dr destination register
   * @param sr source register
   * @param comment optional comment
   */
  public emitMove(dr: Register, sr: Register, comment: string = ''): void {
    if(dr === sr){
      return;
    }
    this.emit([
      new InstructionDirective(Instruction.createOperation(Operation.MOV, dr, sr)).comment(comment),
    ]);
  }

  /**
   * Stores the value in register `sr` into the memory address indicated by `dr` `size`
   * times.
   *
   * @param dr destination register.
   * @param sr source register.
   * @param size the number of bytes to store.
   * @param comment optional comment.
   */
  public emitStaticStore(dr: Register, sr: Register, size: number = 1, comment: string = ''): void {
    if(size <= 0){
      throw new InternalError(`invalid store ${size}`);
    }

    // "Unroll" lops of length 1.
    if(size === 1){
      this.emit([
        new InstructionDirective(Instruction.createOperation(Operation.STORE, dr, sr)).comment(comment),
      ]);
      return;
    }

    // Otherwise emit a loop.
    const cr = this.allocateRegister();
    this.emit([
      new ConstantDirective(cr, new ImmediateConstant(size)),
    ]);
    this.emitDynamicStore(dr, sr, cr, comment);
    this.deallocateRegister(cr);
  }

  /**
   * Stores the value in register `sr` into the memory address indicated by `dr` `cr` times.
   *
   * @param dr destination register.
   * @param sr source register.
   * @param cr count register.
   * @param comment optional comment.
   */
  public emitDynamicStore(dr: Register, sr: Register, cr: Register, comment: string = ''): void {
    const loop = this.generateReference('dynamic_store');
    const loopR = this.allocateRegister(); // Jump address.
    const di = this.allocateRegister(); // Destination index.
    const ci = this.allocateRegister(); // Count index.
    const tr = this.allocateRegister(); // Temporary.

    // Initialize.
    this.emit([
      new ConstantDirective(loopR, new ReferenceConstant(loop)).comment(comment),
      new ConstantDirective(ci, new ImmediateConstant(0)),
    ]);
    this.emitMove(di, dr);

    // Loop through `cr` times, copying `sr` the destination and incrementing
    // by one each time.
    this.emit([
      new LabelDirective(loop),
      new InstructionDirective(Instruction.createOperation(Operation.STORE, di, sr)),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, di, di, Compiler.ONE)),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, ci, ci, Compiler.ONE)),
      new InstructionDirective(Instruction.createOperation(Operation.EQ, tr, ci, cr)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, tr, loopR)),
    ]);

    this.deallocateRegister(loopR);
    this.deallocateRegister(di);
    this.deallocateRegister(ci);
    this.deallocateRegister(tr);
  }

  /**
   * Copies the value located at the memory address indicated by `sr` into the
   * memory address indicated by `dr`. Used when the number of bytes to copy is
   * statically known.
   *
   * @param dr destination address register.
   * @param sr source address register.
   * @param size the number of bytes to copy.
   * @param comment optional comment.
   */
  public emitStaticCopy(dr: Register, sr: Register, size: number, comment: string = ''): void {
    if(size <= 0){
      throw new InternalError(`invalid copy ${size}`);
    }

    // Non-integrals have `size >= 1` (because you can have a 1-byte struct), and must
    // be copied byte by byte. `dr` holds the destination *address*, and `sr` the source address.

    // "Unroll" loops of length 1.
    if(size === 1){
      const r = this.allocateRegister();
      this.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, r, sr)).comment(comment),
        new InstructionDirective(Instruction.createOperation(Operation.STORE, dr, r)),
      ]);
      this.deallocateRegister(r);
      return;
    }

    // For fun, let's *actually* unroll small loops.
    if(size <= 8){
      this.emitUnrolledStaticCopy(dr, sr, size, comment);
      return;
    }

    // Otherwise, we'll emit a loop.
    const cr = this.allocateRegister();
    this.emit([
      new ConstantDirective(cr, new ImmediateConstant(size)),
    ]);
    this.emitDynamicCopy(dr, sr, cr, comment);
    this.deallocateRegister(cr);
  }

  /**
   * Copies the value located at the memory address indicated by `sr` into the
   * memory address indicated by `dr`. Used when the number of bytes to copy is
   * only known at runtime.
   *
   * @param dr destination address register.
   * @param sr source address register.
   * @param cr count register.
   * @param comment optional comment.
   */
  public emitDynamicCopy(dr: Register, sr: Register, cr: Register, comment: string = ''): void {
    const loop = this.generateReference('store');
    const loopR = this.allocateRegister(); // Jump address.
    const di = this.allocateRegister(); // Destination index.
    const si = this.allocateRegister(); // Source index.
    const ci = this.allocateRegister(); // Count index.
    const tr = this.allocateRegister(); // Temporary.

    // Initialize.
    this.emit([
      new ConstantDirective(loopR, new ReferenceConstant(loop)).comment(comment),
      new ConstantDirective(ci, new ImmediateConstant(0)),
    ]);
    this.emitMove(di, dr);
    this.emitMove(si, sr);

    // Loop through `cr` times, copying bytes from the source to the destination and incrementing
    // by one each time.
    this.emit([
      new LabelDirective(loop),
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, tr, si)),
      new InstructionDirective(Instruction.createOperation(Operation.STORE, di, tr)),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, di, di, Compiler.ONE)),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, si, si, Compiler.ONE)),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, ci, ci, Compiler.ONE)),
      new InstructionDirective(Instruction.createOperation(Operation.EQ, tr, ci, cr)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, tr, loopR)),
    ]);

    this.deallocateRegister(loopR);
    this.deallocateRegister(di);
    this.deallocateRegister(si);
    this.deallocateRegister(ci);
    this.deallocateRegister(tr);
  }

  private emitUnrolledStaticCopy(dr: Register, sr: Register, size: number, comment: string = ''): void {
    const di = this.allocateRegister();
    const si = this.allocateRegister();
    const rc = this.allocateRegister();

    this.emitMove(di, dr, comment);
    this.emitMove(si, sr);

    for(let i = 0; i < size; i++){
      this.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, rc, si)).comment(`copy byte ${i}`),
        new InstructionDirective(Instruction.createOperation(Operation.STORE, di, rc)),
      ]);
      if(i < size - 1){
        this.emit([
          new InstructionDirective(Instruction.createOperation(Operation.ADD, di, di, Compiler.ONE)),
          new InstructionDirective(Instruction.createOperation(Operation.ADD, si, si, Compiler.ONE)),
        ]);
      }
    }

    this.deallocateRegister(di);
    this.deallocateRegister(si);
    this.deallocateRegister(rc);
  }

  /**
   * Emits a reference to the given identifier.
   *
   * @param identifier the identifier to reference.
   * @param storage the storage class of the reference.
   * @param dr the destination register in which to store the reference.
   * @param dereference whether to emit a dereference of the address, too.
   */
  public emitIdentifier(identifier: string, storage: Storage, dr: Register, dereference: boolean): void {
    switch(storage){
      case 'global': {
        // Global variables live in the code.
        const reference = new Reference(identifier);
        this.emit([
          new ConstantDirective(dr, new ReferenceConstant(reference)).comment(`global address ${reference}`),
        ]);
        if(dereference){
          this.emit([
            new InstructionDirective(Instruction.createOperation(Operation.LOAD, dr, dr)).comment(`dereference ${reference}`),
          ]);
        }
        return;
      }
      case 'function': {
        // Functions live in the code.
        const reference = new Reference(identifier);
        this.emit([
          new ConstantDirective(dr, new ReferenceConstant(reference)).comment(`function address ${reference}`),
        ]);
        if(dereference){
          throw new InternalError(`cannot dereference function ${identifier}`);
        }
        return;
      }
      default:
        throw new InternalError(`invalid storage ${storage}`);
    }
  }

  /**
   * Increments the given register by the given constant, ignoring `0` and
   * using `Compiler.ONE` for `1`.
   *
   * @param r the register to increment.
   * @param n the constant value to increment the register by.
   * @param comment optional comment.
   */
  protected increment(r: Register, n: number = 1, comment: string = ''): Directive[] {
    if(n === 0){
      return [];
    }

    if(n === 1){
      return [
        new InstructionDirective(Instruction.createOperation(Operation.ADD, r, r, Compiler.ONE)).comment(comment),
      ];
    }

    const sr = this.allocateRegister();
    const directives = [
      new ConstantDirective(sr, new ImmediateConstant(n)),
      new InstructionDirective(Instruction.createOperation(Operation.ADD, r, r, sr)).comment(comment),
    ];
    this.deallocateRegister(sr);
    return directives;
  }

  public emitIncrement(r: Register, n: number = 1, comment: string = ''): void {
    this.emit(this.increment(r, n, comment));
  }

  public emitNullCheck(r: Register): void {
    const er = this.allocateRegister();
    const endRef = this.generateReference('null_check_end');

    this.emit([
      new ConstantDirective(er, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, r, er)),
      new ConstantDirective(Compiler.RET, new ImmediateConstant(Compiler.NULL_ERROR)).comment('null error'),
      new InstructionDirective(Instruction.createOperation(Operation.HALT)),
      new LabelDirective(endRef),
    ]);

    this.deallocateRegister(er);
  }

  /**
   * Emits a bounds check.
   *
   * @param ar the register holding the address of the array.
   * @param ir the register holding the index, in elements.
   */
  public emitBoundsCheck(ar: Register, ir: Register, lengthOffset: number = 0): void {
    const sr = this.allocateRegister();
    const er = this.allocateRegister();
    const endRef = this.generateReference('bounds_check_end');

    this.emitMove(sr, ar, 'array/slice address');
    if(lengthOffset > 0){
      this.emitIncrement(sr, lengthOffset, 'length offset');
    }
    // VM comparison ops return 0 for true, 1 for false (inverted from C semantics)
    // LT(index, length) returns 0 if index < length
    // JZ jumps if condition is 0, so it jumps when index < length (skip bounds error)
    this.emit([
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, sr, sr)).comment('length'),
      new InstructionDirective(Instruction.createOperation(Operation.LT, sr, ir, sr)),
      new ConstantDirective(er, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, sr, er)),
      new ConstantDirective(Compiler.RET, new ImmediateConstant(Compiler.BOUNDS_ERROR)).comment('bounds error'),
      new InstructionDirective(Instruction.createOperation(Operation.HALT)),
      new LabelDirective(endRef),
    ]);

    this.deallocateRegister(er);
    this.deallocateRegister(sr);
  }

  /**
   * Emits a check that the new length for an array fits within
   * the array's capacity.
   *
   * @param ar the register holding the address of the array.
   * @param lr the register holding the new length, in elements.
   */
  public emitCapacityCheck(ar: Register, lr: Register): void {
    const endRef = this.generateReference('capacity_check_end');

    const cr = this.allocateRegister();
    const er = this.allocateRegister();

    this.emit([
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, cr, ar)).comment('load capacity'),
      new InstructionDirective(Instruction.createOperation(Operation.GT, cr, lr, cr)).comment('compare capacity with new len'),
      new ConstantDirective(er, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, cr, er)),
      new ConstantDirective(Compiler.RET, new ImmediateConstant(Compiler.CAPACITY_ERROR)).comment('capacity error'),
      new InstructionDirective(Instruction.createOperation(Operation.HALT)),
      new LabelDirective(endRef),
    ]);

    this.deallocateRegister(cr);
    this.deallocateRegister(er);
  }
}

abstract class StorageCompiler extends Compiler {
  public abstract allocateStorage(identifier: string, size: number): void;

  /**
   * Emits code to convert an array to a slice descriptor.
   * Array layout: [length][data...]
   * Slice layout: [pointer][length][capacity]
   *
   * @param arrayReg Register containing the array address. Deallocated after use.
   * @returns Register containing the address of a new slice descriptor.
   */
  public emitArrayToSlice(arrayReg: Register): Register {
    // Allocate temporary storage for slice descriptor (3 words).
    const tempId = this.generateIdentifier('slice_temp');
    this.allocateStorage(tempId, 3);

    const sliceReg = this.allocateRegister();
    this.emitIdentifier(tempId, 'local', sliceReg, false);

    // Store pointer: array address + 1 (skip length header).
    const ptrReg = this.allocateRegister();
    this.emit([
      new InstructionDirective(
        Instruction.createOperation(Operation.ADD, ptrReg, arrayReg, Compiler.ONE)
      ).comment('slice.pointer = array + 1'),
    ]);
    this.emitStaticStore(sliceReg, ptrReg, 1, 'slice.pointer');
    this.deallocateRegister(ptrReg);

    // Load array length and store as slice length and capacity.
    const lenReg = this.allocateRegister();
    this.emit([
      new InstructionDirective(
        Instruction.createOperation(Operation.LOAD, lenReg, arrayReg)
      ).comment('load array length'),
    ]);

    this.emitIncrement(sliceReg, 1);
    this.emitStaticStore(sliceReg, lenReg, 1, 'slice.length');
    this.emitIncrement(sliceReg, 1);
    this.emitStaticStore(sliceReg, lenReg, 1, 'slice.capacity');
    this.deallocateRegister(lenReg);

    // Reset slice register to point to start of descriptor.
    this.emitIdentifier(tempId, 'local', sliceReg, false);

    // Deallocate the original array register.
    this.deallocateRegister(arrayReg);

    return sliceReg;
  }
}

/**
 * A compiler for global initializer expressions; temporary storage is allocated in a
 * special store.
 */
class GlobalCompiler extends StorageCompiler {
  private temporaryStorage: number = 0;
  private temporaries: { [identifier: string ]: number } = {};
  private temporaryReference: Reference;

  public constructor(identifier: string){
    super(identifier);

    this.temporaryReference = this.generateReference('temporary');
  }

  public allocateStorage(identifier: string, size: number = 1): void {
    this.temporaries[identifier] = this.temporaryStorage;
    this.temporaryStorage += size;
  }

  public emitIdentifier(identifier: string, storage: Storage, dr: Register, dereference: boolean): void {
    switch(storage){
      case 'parameter': {
        throw new InternalError(`invalid parameter identifier ${identifier}`);
      }
      case 'local': {
        // Locals live in our temporary storage area.
        let location = this.temporaries[identifier];
        if(location !== undefined){
          const tr = this.allocateRegister();
          this.emit([
            new ConstantDirective(tr, new ReferenceConstant(this.temporaryReference)),
            new ConstantDirective(dr, new ImmediateConstant(location)).comment(`temporary address ${identifier}`),
            new InstructionDirective(Instruction.createOperation(Operation.ADD, dr, tr, dr)),
          ]);
          if(dereference){
            this.emit([
              new InstructionDirective(Instruction.createOperation(Operation.LOAD, dr, dr)).comment(`dereference ${identifier}`),
            ]);
          }
          this.deallocateRegister(tr);
          return;
        }
        throw new InternalError(`invalid local identifier ${identifier}`);
      }
      case 'global':
      case 'function':
        return super.emitIdentifier(identifier, storage, dr, dereference);
    }
  }

  public compile(): Directive[] {
    const directives: Directive[] = [];
    if(this.temporaryStorage){
      directives.push(new DataDirective(this.temporaryReference, new ImmediatesData(new Array(this.temporaryStorage).fill(0))));
    }
    directives.push(...super.compile());
    return directives;
  }
}

/**
 * A compiler for functions; understands storage for locals and how to reference them,
 * returns, and how to build function prologues and epilogues.
 */
class FunctionCompiler extends StorageCompiler {
  protected localStorage: number = 0;
  private locals: { [identifier: string ]: number } = {};

  private readonly parameterStorage: number = 0;
  private parameters: { [ identifier: string]: number } = {};

  public constructor(identifier: string, parameters: Parameter[]){
    super(identifier);

    // Find location of parameters.
    //
    // Example: Point, byte, Point:
    // p.y
    // p.x
    // b
    // p.y
    // p.x
    // ret
    this.parameterStorage = parameters.reduce((size, parameter) => parameter.size + size, 0);
    let parameterOffset = 0;
    parameters.forEach((parameter) => {
      parameterOffset += parameter.size;
      this.parameters[parameter.identifier] = this.parameterStorage - parameterOffset;
    });
  }

  /**
   * Allocates storage for the given identifier in the current compiler context.
   *
   * @param identifier the identifer to name this storage location.
   * @param size the number of bytes to allocate.
   */
  public allocateStorage(identifier: string, size: number = 1): void {
    this.localStorage += size;
    this.locals[identifier] = this.localStorage;
  }

  /**
   * Emits a reference to the given identifier.
   *
   * @param identifier the identifier to reference
   * @param storage the storage class of the reference
   * @param dr the destination register in which to store the reference
   * @param dereference whether to emit a dereference of the address, too.
   */
  public emitIdentifier(identifier: string, storage: Storage, dr: Register, dereference: boolean): void {
    switch(storage){
      case 'parameter': {
        // Parameters live on the stack, at the beginning of the stack frame, so we
        // add the parameter offset to the stack frame's base address to find the address
        // of the parameter.
        let location = this.parameters[identifier];
        if(location !== undefined){
          // The offset must take into account the stack frame address and the return address.
          const offset = location + 1;

          const sfr = this.allocateRegister();
          this.emitPeek(sfr, 'stack frame address');
          this.emit([
            new ConstantDirective(dr, new ImmediateConstant(offset)).comment(`argument address ${identifier}`),
            new InstructionDirective(Instruction.createOperation(Operation.ADD, dr, sfr, dr)),
          ]);
          this.deallocateRegister(sfr);

          if(dereference){
            this.emit([
              new InstructionDirective(Instruction.createOperation(Operation.LOAD, dr, dr)).comment(`dereference ${identifier}`),
            ]);
          }
          return;
        }
        throw new InternalError(`invalid parameter identifier ${identifier}`);
      }
      case 'local': {
        // Locals live on the stack, after the arguments, callee-save registers, and return address.
        let location = this.locals[identifier];
        if(location !== undefined){
          if(location === 1){
            this.emitPeek(dr, 'stack frame address');
            this.emit([
              new InstructionDirective(Instruction.createOperation(Operation.SUB, dr, dr, Compiler.ONE)).comment(`local address ${identifier}`),
            ]);
          }
          else {
            const sfr = this.allocateRegister();
            this.emitPeek(sfr, 'stack frame address');
            this.emit([
              new ConstantDirective(dr, new ImmediateConstant(location)).comment(`local address ${identifier}`),
              new InstructionDirective(Instruction.createOperation(Operation.SUB, dr, sfr, dr)),
            ]);
            this.deallocateRegister(sfr);
          }
          if(dereference){
            this.emit([
              new InstructionDirective(Instruction.createOperation(Operation.LOAD, dr, dr)).comment(`dereference ${identifier}`),
            ]);
          }
          return;
        }
        throw new InternalError(`invalid local identifier ${identifier}`);
      }
      case 'global':
      case 'function':
        return super.emitIdentifier(identifier, storage, dr, dereference);
      default:
        throw new InternalError(`invalid storage ${storage}`);
    }
  }

  /**
   * Emits a return from the function being compiled.
   *
   * @param sr the register containing the return value.
   */
  public emitReturn(sr: Register): void {
    const r = this.allocateRegister();
    const returnRef = this.createReference('return');
    this.emitMove(Compiler.RET, sr);
    this.emit([
      new ConstantDirective(r, new ReferenceConstant(returnRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);
    this.deallocateRegister(r);
  }

  protected prologue(): Directive[] {
    const storeCalleeSaveRegisters: Directive[] = [];
    const calleeSave = this.registers.calleeSave;
    calleeSave.forEach((r) => {
      storeCalleeSaveRegisters.push(...this.push(r, 'push callee-save register'));
    });

    const r = this.allocateRegister();

    const directives = [
      new LabelDirective(this.createReference('start')), // Just a nicety.

      // Save the return-to address.
      ...this.push(Compiler.RET, 'push return address'),

      new InstructionDirective(Instruction.createOperation(Operation.MOV, r, Compiler.SP)).comment('frame start'),

      // Allocate storage.
      ...this.pushMany(this.localStorage, 'allocate local storage'),

      // Callee save.
      ...storeCalleeSaveRegisters,
    ];

    directives.push(...this.push(r, 'push frame start'));

    this.deallocateRegister(r);
    return directives;
  }

  protected epilogue(): Directive[] {
    const r = this.allocateRegister();
    const directives: Directive[] = [
      // This is the label that return statements within the function jump to.
      new LabelDirective(this.createReference('return')),

      // Deallocate storage; this deallocates all callee save registers, temporary storage,
      // local storage.
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, Compiler.SP, Compiler.SP)).comment('restore sp'),

       // Recover return-to address.
      ...this.pop(r, 'pop return address'),

      // Return.
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)).comment('return'),

      // Just a nicety.
      new LabelDirective(this.createReference('end')), // Just a nicety.
    ];

    this.deallocateRegister(r);

    return directives;
  }

  public compile(reference?: Reference): Directive[] {
    return [
      new LabelDirective(reference || new Reference(this.prefix)),
      ...this.prologue(),
      ...super.compile(),
      ...this.epilogue(),
    ];
  }
}

class InterruptCompiler extends FunctionCompiler {
  protected prologue(): Directive[] {
    const r = this.allocateRegister();

    const directives = [
      new LabelDirective(this.createReference('start_interrupt_handler')), // Just a nicety.

      new InstructionDirective(Instruction.createOperation(Operation.MOV, r, Compiler.SP)).comment('frame start'),

      // Allocate storage.
      ...this.pushMany(this.localStorage, 'allocate local storage'),
    ];

    directives.push(...this.push(r, 'push frame start'));

    this.deallocateRegister(r);
    return directives;
  }

  protected epilogue(): Directive[] {
    const r = this.allocateRegister();
    const directives: Directive[] = [
      // This is the label that return statements within the function jump to.
      new LabelDirective(this.createReference('return')),

      // Deallocate storage; this deallocates all callee save registers, temporary storage,
      // local storage.
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, Compiler.SP, Compiler.SP)).comment('restore sp'),

      // Return.
      new ConstantDirective(r, new ImmediateConstant(0)),
      new InstructionDirective(Instruction.createOperation(Operation.INT, undefined, r)).comment('interrupt return'),

      // Just a nicety.
      new LabelDirective(this.createReference('end_interrupt_handler')), // Just a nicety.
    ];

    this.deallocateRegister(r);

    return directives;
  }
}

export {
  Compiler, StorageCompiler, InterruptCompiler, FunctionCompiler, GlobalCompiler, RegisterAllocator,
}
