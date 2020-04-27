import { InternalError, duplicates, HasLocation, HasTags, mixin, IParseOptions, IFileRange, stringToCodePoints } from '../lib/util';
import {
  ConstantDirective, ImmediateConstant, ReferenceConstant,
  InstructionDirective,
  LabelDirective,
  TextData,

  AssemblyProgram,
} from '../assembly/assembly';
import { Type, Storage, PointerType, FunctionType, StructType, ArrayType } from './types';
import { TypeChecker, KindChecker } from './typechecker';
import { Compiler, StorageCompiler } from './compiler';
import { Immediate } from '../lib/base-types';
import { Instruction, Operation, } from '../vm/instructions';
import { Register } from '../vm/instructions';

///////////////////////////////////////////////////////////////////////
// Expressions.
///////////////////////////////////////////////////////////////////////
/**
 * Class decorator that ensures that after typechecking expressions
 * always store their concrete (fully resolved) type.
 *
 * TODO: maybe we don't want this?
 *
 * @param constructor class to decorate.
 */
function expression(constructor: new (...args: any[]) => Expression){
  const typecheck = constructor.prototype.typecheck;
  constructor.prototype.typecheck = function(context: TypeChecker, contextual?: Type){
    const type = typecheck.call(this, context, contextual);
    this._concreteType = type.resolve(context);
    return type;
  };
}

/**
 * Abstract base class for expressions.
 */
abstract class Expression extends mixin(HasTags, HasLocation) {
  public constructor(concreteType?: Type){
    super();
    this._concreteType = concreteType;
  }

  /**
   * Typechecks the expression and returns its (non-resolved) type.
   *
   * @param typeTable the type table to use
   * @param symbolTable the symbol table to use
   */
  public abstract typecheck(context: TypeChecker, contextualType?: Type): Type;

  /**
   * Emits instructions that store the "rvalue" of the expression in a register, and returns
   * the register.  For integral expressions the rvalue of the expression is the actual
   * value of the expression, and so the register will hold that value. For non-integral
   * expressions, the rvalue of the expression is the *address* at which the actual value is
   * located.
   *
   * @param compiler the `compiler` managing register allocation, storage, and references.
   * @param lvalue whether to compile the expression as an "lvalue"; for *both* integral
   * and non-integral expressions, the lavlue of the expression is the *address* at which
   * the value of the expression is stored.
   */
  public abstract compile(compiler: Compiler, lvalue?: boolean): Register;

  /**
   * Returns whether the code generated for this expression needs to include a dereference.
   *
   * @param lvalue whether this expression is being compield as an "lvalue".
   */
  protected needsDereference(lvalue?: boolean, storage?: Storage){
    if(storage === 'function'){
      return false;
    }

    // HACK: we can use a new type checker because we already have a concrete type.
    return !lvalue && this.concreteType.isIntegral();
  }

  /**
   * The concrete type of the typechecked expression.
   */
  public get concreteType(): Type {
    if(!this._concreteType){
      throw new InternalError(`${this} has not been typechecked`);
    }
    return this._concreteType;
  }
  private _concreteType?: Type; // : Type & not IdentifierType

  /**
   * Whether the expression is assignable; this includes global and local
   * variables, index expressions, dot expressions, and dereference expressions.
   */
  public get isAssignable() {
    return false;
  }

  /**
   * Compiles the given stand-alone expression; for testing.
   *
   * @param expression the expression to compile.
   */
  public static compile(expression: Expression): AssemblyProgram {
    const compiler = new Compiler('expression');
    expression.compile(compiler);

    return new AssemblyProgram(compiler.compile());
  }

  /**
   * Returns the compile-time value of this expression, if there is one.
   */
  public constant(): Immediate | undefined {
    return;
  }
}
interface Expression extends HasTags, HasLocation {}


@expression
class IdentifierExpression extends Expression {
  private identifier: string;
  private qualifiedIdentifier?: string;
  private storage?: Storage;

  public constructor(identifier: string){
    super();
    this.identifier = identifier;
  }

  public typecheck(context: TypeChecker): Type {
    const lookup = context.symbolTable.lookup(context.namespace, this.identifier);
    if(lookup === undefined){
      this.error(context, `unknown identifier ${this.identifier}`);
      return Type.Error;
    }

    this.storage = lookup.value.storage;
    this.qualifiedIdentifier = lookup.qualifiedIdentifier;

    return lookup.value.type;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const r = compiler.allocateRegister();
    if(this.storage === undefined || this.qualifiedIdentifier === undefined){
      throw new InternalError(`${this} has not been typechecked`);
    }

    // We only dereference when we are evaluating an integral.
    compiler.emitIdentifier(this.qualifiedIdentifier, this.storage, r, this.needsDereference(lvalue, this.storage));
    return r;
  }

  public get isAssignable() {
    return true;
  }

  public toString(){
    return this.identifier;
  }
}

@expression
class IntLiteralExpression extends Expression {
  public readonly immediate: Immediate;

  public constructor(immediate: Immediate){
    super(Type.Byte);
    this.immediate = immediate;
  }

  public typecheck(context: TypeChecker, contextualType?: Type): Type {
    // If we contextually know we want a specific numeric type, let's use that.
    if(contextualType && contextualType.isNumeric(context)){
      return contextualType;
    }
    return Type.Byte;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(this.immediate)),
    ]);
    return r;
  }

  public toString(){
    return this.immediate.toString();
  }

  public constant(): Immediate | undefined {
    return this.immediate;
  }
}

@expression
class BoolLiteralExpression extends Expression {
  public readonly value: boolean;

  public constructor(value: boolean){
    super();
    this.value = value;
  }

  public typecheck(context: TypeChecker, contextualType?: Type): Type {
    return Type.Bool;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(this.value ? 1 : 0)),
    ]);
    return r;
  }

  public toString(){
    return this.value ? 'true' : 'false';
  }

  public constant(): Immediate | undefined {
    return this.value ? 1 : 0;
  }
}

function compileLiteralExpressions(hint: string, compiler: Compiler, expressions: Expression[], size?: number): Register {
  // We can only compile non-integral literals when our compiler supports storage.
  if(!(compiler instanceof StorageCompiler)){
    throw new InternalError(`expected storage when compiling literal expression`);
  }

  const identifier = compiler.generateIdentifier(hint);

  // Allocate local storage; include enough space for the size, if requested.
  let bytes = size === undefined ? 0 : 1;
  expressions.forEach((expression) => {
    bytes += expression.concreteType.size;
  });
  compiler.allocateStorage(identifier, bytes);

  const r = compiler.allocateRegister();
  const ri = compiler.allocateRegister();

  compiler.emitIdentifier(identifier, 'local', r, false);
  compiler.emitMove(ri, r, 'initialize destination pointer');

  // Emit the size, if requested.
  if(size !== undefined){
    const sr = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(sr, new ImmediateConstant(size)).comment(`size ${size}`),
    ]);
    compiler.emitStaticStore(ri, sr, 1, `store size`);
    compiler.emitIncrement(ri, 1, 'array[0]');
    compiler.deallocateRegister(sr);
  }

  // Evaluate each value and store it in the data.
  expressions.forEach((expression, i) => {
    const er = expression.compile(compiler);

    if(expression.concreteType.isIntegral()){
      compiler.emitStaticStore(ri, er, 1, 'store integral');
    }
    else {
      compiler.emitStaticCopy(ri, er, expression.concreteType.size, 'copy non-integral');
    }
    compiler.deallocateRegister(er);

    if(i < expressions.length - 1){
      compiler.emitIncrement(ri, expression.concreteType.size, 'next literal expression');
    }
  });

  compiler.deallocateRegister(ri);

  return r;
}

@expression
class StringLiteralExpression extends Expression {
  public readonly text: string;
  private codePoints: number[];

  public constructor(text: string){
    super();
    this.text = text;
    this.codePoints = stringToCodePoints(this.text);
  }

  public typecheck(context: TypeChecker): Type {
    return new ArrayType(Type.Byte);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const expressions = this.codePoints.map((c) => new IntLiteralExpression(c));
    return compileLiteralExpressions('string_literal', compiler, expressions, this.length);
  }

  public get length(): number {
    return this.codePoints.length;
  }

  public toString(){
    return `'${TextData.escape(this.text)}'`;
  }
}

@expression
class ArrayLiteralExpression extends Expression {
  private expressions: Expression[];

  public constructor(expressions: Expression[]){
    super();
    this.expressions = expressions;
  }

  public typecheck(context: TypeChecker, contextualType?: Type): Type {
    // Three cases: we have a contextual type, we have at least 1 expression, or we have neither.
    let elementType: Type | undefined;
    if(contextualType){
      if(!(contextualType instanceof ArrayType)){
        this.error(context, `expected contextual array type, actual ${contextualType}`);
      }
      else {
        elementType = contextualType.index();
      }
    }

    // We don't need to typecheck the expressions if there are none.
    if(!this.expressions.length){
      if(!elementType){
        this.error(context, `expected contextual array type for empty array`);
        elementType = Type.Error;
      }
      return new ArrayType(elementType);
    }

    // Each element of an array must have the same type; note that, similarly to
    // assignment, we allow conversion.
    const expression = this.expressions[0];
    const expressions = this.expressions.slice(1);

    // Check the first expression.
    const initialElementType = expression.typecheck(context);
    if(elementType && !elementType.isConvertibleTo(initialElementType, context)){
      this.error(context, `expected ${elementType}, actual ${initialElementType}`);
    }

    // Prefer the contextual type to the initial element.
    const actualElementType = elementType || initialElementType;

    // Check the rest of the expressions.
    expressions.forEach((expression) => {
      const actualType = expression.typecheck(context);
      if(!actualElementType.isConvertibleTo(actualType, context)){
        this.error(context, `expected ${actualElementType}, actual ${actualType}`);
      }
    });

    return new ArrayType(actualElementType, this.expressions?.length);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    return compileLiteralExpressions('array_literal', compiler, this.expressions, this.expressions.length);
  }

  public toString(){
    return `[ ${this.expressions.join(', ')} ]`;
  }

  public get length(): number {
    return this.expressions.length;
  }
}

type MemberLiteralExpression = {
  identifier: string;
  expression: Expression
}

@expression
class StructLiteralExpression extends Expression {
  public readonly type: Type;
  private memberExpressions: MemberLiteralExpression[];

  public constructor(type: Type, memberExpressions: MemberLiteralExpression[]){
    super();
    this.type = type;
    this.memberExpressions = memberExpressions;
  }

  public typecheck(context: TypeChecker): Type {
    this.type.kindcheck(context, new KindChecker());

    const structType = this.type.resolve(context);

    if(structType instanceof StructType){
      // Ensure we have no duplicates.
      const identifiers = this.memberExpressions.map((m) => m.identifier);
      const duplicateIdentifiers = duplicates(identifiers);
      if(duplicateIdentifiers.length){
        this.error(context, `duplicate members ${duplicateIdentifiers.join(', ')}`);
      }

      // Check each member. Note that, similarly to assignment, we allow conversion.
      this.memberExpressions.forEach((member) => {
        const structMember = structType.member(member.identifier);
        if(structMember !== undefined){
          const type = member.expression.typecheck(context, structMember.type);
          if(!structMember.type.isConvertibleTo(type, context)){
            this.error(context, `member ${member.identifier} expected ${structMember.type}, actual ${type}`);
          }
        }
      });

      // Ensure we have no missing members.
      structType.members.forEach((member) => {
        if(identifiers.indexOf(member.identifier) === -1){
          this.error(context, `member ${member.identifier} expected`);
        }
      });

      return this.type;
    }

    this.error(context, `expected struct type, actual ${this.type}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const structType = this.concreteType;
    if(!(structType instanceof StructType)){
      throw new InternalError(`struct literal with invalid type`);
    }

    return compileLiteralExpressions('struct_literal', compiler, this.memberExpressions.map((m) => m.expression));
  }

  public toString(){
    return `{ ${this.memberExpressions.map((m) => `${m.identifier} = ${m.expression}`).join(', ')} }`;
  }
}

@expression
class NullExpression extends Expression {
  public typecheck(context: TypeChecker, contextual?: Type): Type {
    if(!contextual || !(contextual.resolve(context) instanceof PointerType)){
      this.error(context, `expected contextual pointer type for null`);
      return Type.Error;
    }
    return contextual;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const dr = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(dr, new ImmediateConstant(0)),
    ]);
    return dr;
  }

  public constant(): number {
    return 0;
  }

  public toString(): string {
    return `null`;
  }
}

@expression
class SizeOfExpression extends Expression {
  private type: Type;

  public constructor(type: Type){
    super();
    this.type = type;
  }

  public typecheck(context: TypeChecker): Type {
    this.type.kindcheck(context, new KindChecker());
    return Type.Byte;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(this.type.concreteType.size)).comment(`${this}`),
    ]);
    return r;
  }

  public toString(){
    return `sizeof ${this.type}`;
  }
}


/**
 * Represents a `new` expression of one of the following forms:
 *
 *
 *    new byte              // Allocate a byte on the heap and set it to 0. Returns a * byte.
 *    new byte 2            // Allocate a byte on the heap and set it to 2. Returns a * byte;
 *
 *    new byte[2]           // Allocate a byte array of length 2 on the heap, set each element to 0. Returns a byte[].
 *    new byte[2] ... 2     // Allocate a byte array of length 2 on the heap, set each element to 2. Returns a byte[].
 *
 *    new byte[] [ 2, 3 ]   // Allocate a byte array of length 2 on the heap, set the elements to 2 and 3. Returns a byte[].
 *    new byte[2] [ 2, 3 ]  // Allocate a byte array of length 2 on the heap, set the elements to 2 and 3. Returns a byte[].
 *
 *    new Pointer { x = 0; y = 1 }; // Allocates a `Pointer` (2 bytes) on the heap. Returns a * Pointer.
 *    new * byte;           // Allocates a * byte on the heap
 *
 */
@expression
class NewExpression extends Expression {
  /**
   * When we construct a new expression for a named type, e.g.
   * `new state` where `type state = byte[32]`, we don't realize
   * that we are constructing a new array expression at parse time.
   * So, construct it at type-checking time and forward subsequent
   * calls to it.
   */
  private newArrayExpression?: NewArrayExpression;

  public constructor(private type: Type, private expression?: Expression, private ellipsis: boolean = false){
    super();
  }

  public typecheck(context: TypeChecker): Type {
    this.type.kindcheck(context, new KindChecker());

    const cType = this.type.resolve(context);
    if(cType instanceof ArrayType){
      // This should have been constructed as a new array expression, but we couldn't
      // see that at parse time.  The type *must* be a sized array or we won't
      // know how much memory to allocate.
      if(cType.length === undefined){
        this.error(context, `expected sized array type, actual ${this.type}`);
      }
      this.newArrayExpression = new NewArrayExpression(this.type, new IntLiteralExpression(cType.length || 0), this.expression, this.ellipsis);
      return this.newArrayExpression.typecheck(context);
    }

    // Unexpected ...
    if(this.ellipsis){
      this.error(context, `expected array type, actual ${this.type}`);
    }

    // If we've given the expression an initializer, typecheck it. Pass the
    // type contextually.
    if(this.expression){
      const type = this.expression.typecheck(context, this.type);

      if(!this.type.isEqualTo(type, context)){
        this.error(context, `expected ${this.type}, actual ${type}`);
      }
    }

    return new PointerType(this.type);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    if(this.newArrayExpression){
      return this.newArrayExpression.compile(compiler, lvalue);
    }

    // Allocate storage for the single object.
    const sr = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(sr, new ImmediateConstant(this.type.concreteType.size)).comment('new size'),
    ]);
    const dr = compiler.emitNew(sr);

    // Initialize storage; now `dr` is a pointer to our new memory.
    let er;
    let isZero = false;
    if(this.expression){
      // Compile the initialization expression.
      er = this.expression.compile(compiler);
    }
    else {
      // Use 0 as the initialization expression.
      er = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(er, new ImmediateConstant(0)),
      ]);
      isZero = true;
    }

    // Write to the destination.
    if(this.type.concreteType.isIntegral() || isZero){
      compiler.emitStaticStore(dr, er, this.type.concreteType.size, 'initialize integral new');
    }
    else {
      compiler.emitStaticCopy(dr, er, this.type.concreteType.size, 'initialize new');
    }

    compiler.deallocateRegister(er);

    return dr;
  }

  public toString(){
    if(this.newArrayExpression){
      return this.newArrayExpression.toString();
    }
    if(this.expression){
      return `new ${this.type} = ${this.expression}`;
    }
    return `new ${this.type}`;
  }
}

@expression
class NewArrayExpression extends Expression {
  /**
   * The type of the elements of the array.
   */
  private type: Type;
  private elementType?: Type;

  /**
   * The initializer expression for the newly allocated memory.
   */
  private expression?: Expression;

  /**
   * An expression evaluating to the size of the array to be allocated.
   */
  private size: Expression;

  /**
   * Whether the initializing expression should be treated as the
   * value to initialize the entire array to (when `false`), or each
   * element to (when `true`).
   */
  private ellipsis: boolean = false;

  public constructor(type: Type, size: Expression, expression: Expression | undefined, ellipsis: boolean = false){
    super();
    this.type = type;
    this.size = size;
    this.expression = expression;
    this.ellipsis = ellipsis;
  }

  public typecheck(context: TypeChecker): Type {
    this.type.kindcheck(context, new KindChecker());

    // This type must be an array.
    const cType = this.type.resolve(context);
    if(!(cType instanceof ArrayType)){
      this.error(context, `new array expected array type, actual ${this.type}`);
      return Type.Error;
    }
    this.elementType = cType.index();

    // Size should be a number.
    const sizeType = this.size.typecheck(context);
    if(!sizeType.isNumeric(context)){
      this.error(context, `new array size expected numeric type, actual ${sizeType}`);
    }

    // If we've given the expression an initializer, typecheck it. Pass the
    // type contextually so that we can easily allocate arrays.
    if(this.expression){
      const compareType = this.ellipsis ? this.elementType : this.type;
      const type = this.expression.typecheck(context, compareType);

      if(!compareType.isEqualTo(type, context)){
        this.error(context, `new array initializer expected ${compareType}, actual ${type}`);
      }
    }

    // `new` doesn't return a sized array so that initializing a local
    // variable with `new` has the expected behavior:
    //
    //  var bytes = new byte[10] ... 5;
    //
    // Makes bytes have type `byte[]`, so that it is a pointer on the stack,
    // not a stack-allocated sized array. If it were, we'd copy the bytes
    // from the new expression to the stack, which is probably not wanted.
    return new ArrayType(this.elementType);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    if(!this.elementType || this.size === undefined){
      throw new InternalError(`${this} has not been typechecked`);
    }

    // Allocate storage for the array: the size of the element type times the count of elements,
    // plus one for the size.
    const cr = this.size.compile(compiler); // Count.
    const sr = compiler.allocateRegister(); // Storage size.

    // If we are allocating an array whose elements have size 1,
    // we can skip a multiplication.
    if(this.elementType.concreteType.size > 1){
      const mr = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(mr, new ImmediateConstant(this.elementType.concreteType.size)).comment('new[]: array element size'),
        new InstructionDirective(Instruction.createOperation(Operation.MUL, sr, cr, mr)).comment('new[]: all elements size'),
      ]);
      compiler.deallocateRegister(mr);
    }
    else {
      compiler.emitMove(sr, cr, 'new[]: all elements size');
    }

    // Add space for the array size.
    const tsr = compiler.allocateRegister();
    compiler.emitMove(tsr, sr);
    compiler.emitIncrement(tsr, 1, 'new[]: array size');

    // Allocate the storage; this deallocates `tsr`.
    const dr = compiler.emitNew(tsr, 'new[]');

    // Verify that the return is not null.
    const endRef = compiler.generateReference('new_end');
    const endR = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(endR, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, dr, endR)),
    ]);

    // Write array size..
    compiler.emitStaticStore(dr, cr, 1, 'new[]: store array size');

    // Write to destination; `dr` is a pointer to our new memory.
    let er;
    let isZero = false;
    if(this.expression){
      er = this.expression.compile(compiler);
    }
    else {
      er = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(er, new ImmediateConstant(0)),
      ]);
      isZero = true;
    }

    // Address of first element of destination.
    const adr = compiler.allocateRegister();
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.ADD, adr, dr, Compiler.ONE)).comment('new[]: destination[0]'),
    ]);

    // Ellipsis means we are using the value represented by `er` multiple times.
    if(this.ellipsis){
      if(this.elementType.concreteType.isIntegral() || isZero){
        // memset(dr, er, sr, 1);
        compiler.emitDynamicStore(adr, er, sr, 'new[]: zero initialize');
      }
      else {
        this.compileStructuralEllipsis(compiler, adr, er, cr);
      }

      compiler.deallocateRegister(sr);
      compiler.deallocateRegister(adr);
      compiler.deallocateRegister(er);

      compiler.emit([
        new LabelDirective(endRef),
      ]);
      return dr;
    }

    // `er` is a pointer to an array.
    const minRef = compiler.generateReference('min');
    const minR = compiler.allocateRegister(); // Min calculation jump address.
    const esr = compiler.allocateRegister(); // Size of expression in bytes.
    const tr = compiler.allocateRegister(); // Temporary.

    // First load the size of the expression array in *elements*.
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, esr, er)).comment('new[]: source address'),
    ]);

    // Then multiply by element size if necessary to find the number of bytes to copy.
    if(this.elementType.concreteType.size > 1){
      compiler.emit([
        new ConstantDirective(tr, new ImmediateConstant(this.elementType.concreteType.size)).comment('new[]: source element size'),
        new InstructionDirective(Instruction.createOperation(Operation.MUL, esr, esr, tr)).comment('new[]: source all elements size'),
      ]);
    }

    // We should copy the minimum of `sr` and `esr` bytes, so set `sr` to `esr` if `esr` is less than `sr`.
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.LT, tr, esr, sr)),
      new ConstantDirective(minR, new ReferenceConstant(minRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, tr, minR)),
      new InstructionDirective(Instruction.createOperation(Operation.MOV, sr, esr)),
      new LabelDirective(minRef).comment('new[]: minimum size'),
    ]);

    // Finally we can copy.  First find the beginning of the expression array.
    compiler.emitIncrement(er, 1, 'new[]: source[0]');

    if(isZero){
      compiler.emitDynamicStore(adr, er, sr, 'new[]: initialize');
    }
    else {
      compiler.emitDynamicCopy(adr, er, sr, 'new[]: initialize');
    }

    compiler.deallocateRegister(sr);
    compiler.deallocateRegister(adr);
    compiler.deallocateRegister(er);
    compiler.deallocateRegister(minR);
    compiler.deallocateRegister(esr);
    compiler.deallocateRegister(tr);

    compiler.emit([
      new LabelDirective(endRef),
    ]);

    return dr;
  }

  private compileStructuralEllipsis(compiler: Compiler, dr: Register, er: Register, cr: Register): void {
    if(!this.elementType){
      throw new InternalError(`${this} has not been typechecked`);
    }

    const loopRef = compiler.generateReference('new_ellipsis');

    const loopR = compiler.allocateRegister();
    const di = compiler.allocateRegister(); // The index within the destination.
    const ci = compiler.allocateRegister(); // Counts the number of *elements* that have been written.
    const tr = compiler.allocateRegister();

    compiler.emit([
      new ConstantDirective(loopR, new ReferenceConstant(loopRef)),
      new ConstantDirective(ci, new ImmediateConstant(0)).comment('initialize counter'),
      new InstructionDirective(Instruction.createOperation(Operation.MOV, di, dr)).comment('new[]: destination[0]'),
      new LabelDirective(loopRef),
    ]);

    compiler.emitStaticCopy(di, er, this.elementType.concreteType.size, 'structural ellipsis');

    compiler.emitIncrement(di, this.elementType.concreteType.size, 'increment index');
    compiler.emitIncrement(ci, 1, 'increment counter');
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.EQ, tr, ci, cr)).comment('check for end of element loop'),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, tr, loopR)),
    ]);

    compiler.deallocateRegister(loopR);
    compiler.deallocateRegister(di);
    compiler.deallocateRegister(ci);
    compiler.deallocateRegister(tr);
  }

  public toString(){
    if(this.expression){
      if(this.ellipsis){
        return `new ${this.elementType}[${this.size}] ... ${this.expression}`;
      }
      return `new ${this.elementType}[${this.size}] = ${this.expression}`;
    }
    return `new ${this.elementType}[${this.size}]`;
  }
}

@expression
class CastExpression extends Expression {
  public constructor(private type: Type, private expression: Expression, private unsafe: boolean = false){
    super();
  }

  public typecheck(context: TypeChecker): Type {
    this.type.kindcheck(context, new KindChecker());

    const type = this.expression.typecheck(context, this.type);

    // We can safely cast away nominal differences.
    if(this.type.isConvertibleTo(type, context)){
      if(this.unsafe){
        this.warning(context, `unnecessary unsafe cast between ${this.type} and ${type}`);
      }
      return this.type.tag(['.unsafe']);
    }

    // We can unsafely cast between integral types.
    if(this.type.isIntegral(context) && type.isIntegral(context)){
      if(!this.unsafe){
        this.error(context, `unsafe cast between ${this.type} and ${type}`);
      }
      return this.type;
    }

    // Otherwise we can't.
    this.error(context, `expected convertible to ${this.type}, actual ${type}`);
    return this.type;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    return this.expression.compile(compiler, lvalue);
  }

  public toString(){
    return `<${this.type}>(${this.expression})`;
  }

  public constant(): Immediate | undefined {
    return this.expression.constant();
  }
}

type BinaryOperator =
  '+' | '-' | '*' | '/' |
  '&&' | '||' |
  '==' | '!=' | '<' | '<=' | '>' | '>=';

@expression
class BinaryExpression extends Expression {
  public readonly operator: BinaryOperator;
  public readonly left: Expression;
  public readonly right: Expression;

  public constructor(operator: BinaryOperator, left: Expression, right: Expression){
    super();
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  public typecheck(context: TypeChecker): Type {
    const tLeft = this.left.typecheck(context);
    const tRight = this.right.typecheck(context);

    switch(this.operator){
      case '+':
      case '-':
      case '*':
      case '/': {
        // We can do arithmetic on numbers of the same type.
        if(!tLeft.isNumeric(context)){
          this.error(context, `expected numeric type, actual ${tLeft}`);
        }
        if(!tRight.isNumeric(context)){
          this.error(context, `expected numeric type, actual ${tRight}`);
        }
        if(!tLeft.isEqualTo(tRight, context)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }

        return tLeft;
      }

      case '&&':
      case '||': {
        // We can only treat integrals as truthy/falsy.
        if(!tLeft.isIntegral(context)){
          this.error(context, `expected integral type, actual ${tLeft}`);
        }
        if(!tRight.isIntegral(context)){
          this.error(context, `expected integral type, actual ${tRight}`);
        }

        // Both sides must have the same type.
        if(!tLeft.isEqualTo(tRight, context)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }

        return tLeft;
      }

      case '<':
      case '<=':
      case '>':
      case '>=':
        // We can only compare numerics.
        if(!tLeft.isNumeric(context)){
          this.error(context, `expected numeric type, actual ${tLeft}`);
        }
        if(!tRight.isNumeric(context)){
          this.error(context, `expected numeric type, actual ${tRight}`);
        }
        if(!tLeft.isEqualTo(tRight, context)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }
        return Type.Bool;

      case '==':
      case '!=': {
        // We can only equate integrals.
        if(!tLeft.isIntegral(context)){
          this.error(context, `expected integral type, actual ${tLeft}`);
        }
        if(!tRight.isIntegral(context)){
          this.error(context, `expected integral type, actual ${tRight}`);
        }
        if(!tLeft.isEqualTo(tRight, context)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }

        return Type.Bool;
      }

      default:
        throw new InternalError(`unexpected binary operator ${this.operator}`);
    }
  }

  private get operation(): Operation {
    const operations: { [operator: string]: Operation } = {
      '+': Operation.ADD,
      '-': Operation.SUB,
      '*': Operation.MUL,
      '/': Operation.DIV,
      '%': Operation.MOD,
      '==': Operation.NEQ,
      '!=': Operation.EQ,
      '<': Operation.LT,
      '>': Operation.GT,
      '<=': Operation.GT,
      '>=': Operation.LT,
    };
    const operation = operations[this.operator.toString()];
    if(operation !== undefined){
      return operation;
    }
    throw new InternalError(`unexpected binary operator ${this.operator}`);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    switch(this.operator){
      case '&&':{
        // Lazy evaluation.
        //
        // Evaluate left => lr.
        // If zero, jump exit.
        // Evaluate right, move  rr => lr.
        // Exit:
        // Return lr
        const lr = this.left.compile(compiler);

        const endRef = compiler.generateReference('and_end');
        const r = compiler.allocateRegister();

        compiler.emit([
          new ConstantDirective(r, new ReferenceConstant(endRef)),
          new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, lr, r)),
        ]);

        const rr = this.right.compile(compiler);

        compiler.emitMove(lr, rr);
        compiler.emit([
          new LabelDirective(endRef).comment('end &&'),
        ]);

        compiler.deallocateRegister(rr);

        return lr;
      }

      case '||': {
        // Lazy evaluation.
        //
        // Eavluate left => lr.
        // If non-zero, jump exit.
        // Evaluate right, move rr => lr.
        // Exit:
        // Return lr
        const lr = this.left.compile(compiler);

        const endRef = compiler.generateReference('or_end');
        const r = compiler.allocateRegister();

        compiler.emit([
          new ConstantDirective(r, new ReferenceConstant(endRef)),
          new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, lr, r)),
        ]);

        const rr = this.right.compile(compiler);

        compiler.emitMove(lr, rr);
        compiler.emit([
          new LabelDirective(endRef),
        ]);

        compiler.deallocateRegister(rr);

        return lr;
      }

      case '<':
      case '>': {
        // Our CPU doesn't support <= or >=, so we simulate them.
        const lr = this.left.compile(compiler);
        const rr = this.right.compile(compiler);

        const r = compiler.allocateRegister();
        const zr = compiler.allocateRegister();
        compiler.emit([
          new InstructionDirective(Instruction.createOperation(this.operation, r, lr, rr)),
          new ConstantDirective(zr, new ImmediateConstant(0)),
          new InstructionDirective(Instruction.createOperation(Operation.NEQ, r, r, zr)),
        ]);
        compiler.deallocateRegister(lr);
        compiler.deallocateRegister(rr);
        compiler.deallocateRegister(zr);
        return r;
      }

      default: {
        const lr = this.left.compile(compiler);
        const rr = this.right.compile(compiler);

        const r = compiler.allocateRegister();
        compiler.emit([
          new InstructionDirective(Instruction.createOperation(this.operation, r, lr, rr)),
        ]);

        compiler.deallocateRegister(lr);
        compiler.deallocateRegister(rr);

        return r;
      }
    }
  }

  public toString(){
    return `(${this.left}) ${this.operator} (${this.right})`;
  }

  public static build(left: Expression, tail:[BinaryOperator, Expression][]): Expression {
    return tail.reduce((left, [ op, right ]) => {
      return new BinaryExpression(op, left, right);
    }, left);
  }
}

type UnaryOperator = '-' | '+' | '*' | '&' | '!' | 'len';

@expression
class UnaryExpression extends Expression {
  private operator: UnaryOperator;
  private expression: Expression;

  public constructor(operator: UnaryOperator, expression: Expression){
    super();
    this.operator = operator;
    this.expression = expression;
  }

  public typecheck(context: TypeChecker): Type {
    const type = this.expression.typecheck(context);

    switch(this.operator){
      case '*': {
        const cType = type.resolve(context);
        if(cType instanceof PointerType){
          return cType.dereference();
        }

        this.error(context, `expected pointer type, actual ${type}`);
        return Type.Byte;
      }

      case '+':
      case '-': {
        if(type.isNumeric(context)){
          return type;
        }

        this.error(context, `expected numeric type, actual ${type}`);
        return Type.Byte;
      }

      case '!': {
        if(!type.isIntegral(context)){
          this.error(context, `expected integral type, actual ${type}`);
        }
        return Type.Bool;
      }

      case '&':
        // We can't take the address of void.
        if(type.isConvertibleTo(Type.Void, context)){
          this.error(context, `expected non-void type, actual ${type}`);
        }

        // We can't take the address of something that isn't assignable.
        if(!this.expression.isAssignable){
          this.error(context, `expected assignable expression`);
        }

        // Otherwise we can take the address of anything.
        return new PointerType(type);

      case 'len': {
        const cType = type.resolve(context);
        if(!(cType instanceof ArrayType)){
          this.error(context, `expected array type, actual ${type}`);
        }
        return Type.Byte;
      }
      default:
        throw new InternalError(`unexpected unary operator ${this.operator}`);
    }
  }

  public get isAssignable() {
    // Dereferences are assignable.
    return this.operator === '*';
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    switch(this.operator){
      case '+':
        // This is actually a no-op.
        return this.expression.compile(compiler);
      case '-': {
        // Compile as `0 - e`.
        const er = this.expression.compile(compiler);
        const zr = compiler.allocateRegister();
        compiler.emit([
          new ConstantDirective(zr, new ImmediateConstant(0)).comment(`${this}`),
          new InstructionDirective(Instruction.createOperation(Operation.SUB, er, zr, er)),
        ]);
        compiler.deallocateRegister(zr);
        return er;
      }
      case '*': {
        // Compile the nested value as an rvalue.
        const r = this.expression.compile(compiler, false);

        // Not all expressions of the form `*e` must be dereferenced. For instance,
        // if `e` is an identifier refering to a struct, then `e` is already the address
        // of the struct.
        if(this.needsDereference(lvalue)){
          compiler.emit([
            new InstructionDirective(Instruction.createOperation(Operation.LOAD, r, r)).comment(`${this}`),
          ]);
        }
        return r;
      }
      case '&': {
        // We can only take the address of something that is assignable;
        // if we compile it as an lvalue, we'll get an address.
        return this.expression.compile(compiler, true);
      }
      case '!': {
        const er = this.expression.compile(compiler);

        // We want !0 == 1, and !(non-zero) == 0. This is exactly the semantics of `NEQ`.
        const r = compiler.allocateRegister();
        compiler.emit([
          new ConstantDirective(r, new ImmediateConstant(0)).comment(`${this}`),
          new InstructionDirective(Instruction.createOperation(Operation.NEQ, r, r, er)),
        ]);
        compiler.deallocateRegister(er);
        return r;
      }
      case 'len': {
        // This should be an array, so it's the address of the size.
        const er = this.expression.compile(compiler);
        compiler.emit([
          new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er)).comment(`${this}`),
        ]);
        return er;
      }
      default:
        throw new InternalError(`unexpected unary operator ${this.operator}`);
    }
  }

  public toString(){
    return `${this.operator}(${this.expression})`;
  }
}

@expression
class CallExpression extends Expression {
  private expression: Expression;
  private args: Expression[];

  public constructor(expression: Expression, args: Expression[]){
    super();
    this.expression = expression;
    this.args = args;
  }

  public typecheck(context: TypeChecker): Type {
    const type = this.expression.typecheck(context)
    const cType = type.resolve(context);

    if(cType instanceof FunctionType){
      // Check the correct number of arguments.
      if(this.args.length !== cType.arity){
        this.error(context, `expected ${cType.arity} arguments, actual ${this.args.length}`);
      }

      // Check each argument's type; we check (at most) the expected
      // number of arguments as we've already raised an error above.
      this.args.slice(0, cType.arity).forEach((arg, i) => {
        const argType = arg.typecheck(context);
        const expectedType = cType.argument(i);

        if(!argType.isEqualTo(expectedType, context)){
          this.error(context, `expected ${expectedType}, actual ${argType}`);
        }
      });

      // The resulting type is the function's return type.
      return cType.apply();
    }

    this.error(context, `expected function type, actual ${type}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    // Compile the target location of the function to call.
    const tr = this.expression.compile(compiler, lvalue);

    // Compile the arguments.
    const args = this.args.map((arg) => {
      const r = arg.compile(compiler, lvalue);
      return {
        register: r,
        size: arg.concreteType.size,
        isIntegral: arg.concreteType.isIntegral(),
      };
    });

    // Compile the call; this deallocates the argument and target registers.
    return compiler.emitCall(args, tr);
  }

  public toString(){
    const args = this.args.join(', ');
    return `${this.expression}(${args})`;
  }
}

abstract class SuffixExpression extends Expression {
  public readonly expression: Expression;

  public constructor(expression: Expression){
    super();
    this.expression = expression;
  }

  public get isAssignable() {
    return true;
  }

  public static build(expression: Expression, suffixes: Suffix[]) {
    return suffixes.reduce((expression, suffix) => {
      if(suffix.identifier !== undefined && suffix.pointer){
        return new ArrowExpression(expression, suffix.identifier).at(suffix.range, suffix.text, suffix.options);
      }
      if(suffix.identifier !== undefined && !suffix.pointer){
        return new DotExpression(expression, suffix.identifier).at(suffix.range, suffix.text, suffix.options);
      }
      if(suffix.index !== undefined){
        return new IndexExpression(expression, suffix.index).at(suffix.range, suffix.text, suffix.options);
      }
      throw new InternalError('invalid suffix');
    }, expression);
  }

  public static createIndex(index: Expression, range: IFileRange, text: string, options?: IParseOptions): Suffix {
    return { index, range, text, options };
  }

  public static createMember(identifier: string, pointer: boolean, range: IFileRange, text: string, options?: IParseOptions): Suffix {
    return { identifier, pointer, range, text, options };
  }
}

@expression
class DotExpression extends SuffixExpression {
  public identifier: string;

  private offset: number = -1;

  public constructor(expression: Expression, identifier: string){
    super(expression);
    this.identifier = identifier;
  }

  public typecheck(context: TypeChecker): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve(context);

    if(cType instanceof StructType){
      const member = cType.member(this.identifier);
      if(member !== undefined){
        // Store index for later use during compilation.
        this.offset = cType.offset(this.identifier, context)
        return member.type;
      }
      this.error(context, `invalid identifier ${this.identifier}`);
    }

    this.error(context, `expected struct type, actual ${type}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const er = this.expression.compile(compiler);

    compiler.emitIncrement(er, this.offset, `.${this.identifier}`);

    // We only dereference when we are evaluating an integral, e.g. `point.x` when
    // `x` is a byte.
    if(this.needsDereference(lvalue)){
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er)),
      ]);
    }

    return er;
  }

  public toString(){
    return `(${this.expression}).${this.identifier}`;
  }
}

@expression
class ArrowExpression extends SuffixExpression {
  public identifier: string;

  private offset: number = -1;

  public constructor(expression: Expression, identifier: string){
    super(expression);
    this.identifier = identifier;
  }

  public typecheck(context: TypeChecker): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve(context);

    if(!(cType instanceof PointerType)){
      this.error(context, `expected pointer to struct type, actual ${type}`);
      return Type.Error;
    }
    const structType = cType.dereference().resolve(context);
    if(!(structType instanceof StructType)){
      this.error(context, `expected pointer to struct type, actual ${type}`);
      return Type.Error;
    }

    const member = structType.member(this.identifier);
    if(member !== undefined){
      // Store index for later use during compilation.
      this.offset = structType.offset(this.identifier, context)
      return member.type;
    }

    this.error(context, `invalid identifier ${this.identifier}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const er = this.expression.compile(compiler);

    // We only need to adjust our pointer when we are indexing into the object;
    // if we are referencing the first value, we don't need to.
    compiler.emitIncrement(er, this.offset, `->${this.identifier}`);

    // We only dereference when we are evaluating an integral, e.g. `point->x` when
    // `x` is a byte.
    if(this.needsDereference(lvalue)){
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er)).comment(`deference ${this}`),
      ]);
    }

    return er;
  }

  public toString(){
    return `(${this.expression}).${this.identifier}`;
  }
}

type Suffix = {
  index?: Expression;
  identifier?: string;
  pointer?: boolean;
  range: IFileRange;
  text: string;
  options?: IParseOptions
};

@expression
class IndexExpression extends SuffixExpression {
  public readonly index: Expression;
  private stride?: number;

  public constructor(expression: Expression, index: Expression){
    super(expression);
    this.index = index;
  }

  public typecheck(context: TypeChecker): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve(context);

    const indexType = this.index.typecheck(context);

    let elementType;
    if(cType instanceof ArrayType){
      elementType = cType.index();
    }
    else if(cType instanceof PointerType) {
      elementType = cType.dereference();
    }
    else if(cType === Type.Error){
      // Shhhh....
      elementType = Type.Error;
    }
    else {
      this.error(context, `expected array or pointer type, actual ${type}`);
      return Type.Error;
    }

    // We can only index by a numeric type.
    if(!indexType.isNumeric(context)){
      this.error(context, `index expected numeric type, actual ${type}`);
    }

    this.stride = elementType.concreteType.size;
    return elementType;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    if(this.stride === undefined){
      throw new InternalError(`${this} has not been typechecked`);
    }

    const er = this.expression.compile(compiler);
    const ir = this.index.compile(compiler);

    // TODO: bounds check!

    // The left side is an array; we need to know the size of each element
    // so that we can index into the correct location. So we multiply the index
    // by the stride to get the actual offset.
    if(this.stride > 1){
      const sr = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(sr, new ImmediateConstant(this.stride)).comment(`stride ${this.stride}`),
        new InstructionDirective(Instruction.createOperation(Operation.MUL, ir, ir, sr)).comment('actual index'),
      ]);
      compiler.deallocateRegister(sr);
    }

    // If we are indexing into an array, take into account the size.
    if(this.expression.concreteType instanceof ArrayType){
      compiler.emitIncrement(er);
    }

    // Then we add the actual offset to the array.
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.ADD, er, er, ir)),
    ]);

    // Dereference if required.
    if(this.needsDereference(lvalue)){
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er))
      ]);
    }
    compiler.deallocateRegister(ir);

    return er;
  }

  public toString(){
    return `(${this.expression})[${this.index}]`;
  }
}

@expression
class ConditionalExpression extends Expression {
  private condition: Expression;
  private ifExpression: Expression;
  private elseExpression: Expression;

  public constructor(condition: Expression, ifExpression: Expression, elseExpression: Expression){
    super();
    this.condition = condition;
    this.ifExpression = ifExpression;
    this.elseExpression = elseExpression;
  }

  public typecheck(context: TypeChecker): Type {
    // A conditional's `condition` should be a type that is valid in a boolean context.
    const conditionType = this.condition.typecheck(context);
    if(!conditionType.isIntegral(context)){
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    // Each branch of the conditional should have the same type.
    const ifType = this.ifExpression.typecheck(context);
    const elseType = this.elseExpression.typecheck(context);
    if(!ifType.isEqualTo(elseType, context)){
      this.error(context, `expected ${ifType}, actual ${elseType}`);
    }

    return ifType;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const cr = this.condition.compile(compiler, lvalue);

    const elseRef = compiler.generateReference('cond_else');
    const endRef = compiler.generateReference('cond_end');
    const r = compiler.allocateRegister();

    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(elseRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, cr, r)),
    ]);

    const ir = this.ifExpression.compile(compiler, lvalue);

    compiler.emitMove(cr, ir);
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    compiler.emit([
      new LabelDirective(elseRef),
    ])

    const er = this.elseExpression.compile(compiler, lvalue);
    compiler.emitMove(cr, er);
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(r);
    compiler.deallocateRegister(ir);
    compiler.deallocateRegister(er);

    return cr;
  }

  public toString(){
    return `(${this.condition}) ? (${this.ifExpression}) : (${this.elseExpression})`;
  }

  public static build(left: Expression, tail:[Expression, Expression][]) {
    return tail.reduce((left, [ ifExpression, elseExpression ]) => {
      return new ConditionalExpression(left, ifExpression, elseExpression);
    }, left);
  }
}

export {
  Expression,
  IdentifierExpression,
  IntLiteralExpression, StringLiteralExpression, BoolLiteralExpression,
  BinaryExpression, UnaryExpression,
  CallExpression,
  DotExpression, ArrowExpression, IndexExpression, SuffixExpression,
  ConditionalExpression,
  CastExpression, NewExpression, NewArrayExpression, NullExpression,
  ArrayLiteralExpression, StructLiteralExpression,
  SizeOfExpression,
};
