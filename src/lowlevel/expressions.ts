import { InternalError, duplicates, Syntax, IParseOptions, IFileRange, stringToCodePoints, writeOnce } from '../lib/util';
import {
  ConstantDirective, ImmediateConstant, ReferenceConstant,
  InstructionDirective,
  LabelDirective,
  TextData,

  AssemblyProgram,
} from '../assembly/assembly';
import { Type, Storage, PointerType, TemplateType, FunctionType, StructType, ArrayType, SliceType, VariableType } from './types';
import { TypeChecker, KindChecker } from './typechecker';
import { Compiler, StorageCompiler } from './compiler';
import { Immediate } from '../lib/base-types';
import { Instruction, Operation, } from '../vm/instructions';
import { Register } from '../vm/instructions';
import { TypeTable } from './tables';

///////////////////////////////////////////////////////////////////////
// Expressions.
///////////////////////////////////////////////////////////////////////
/**
 * Abstract base class for expressions.
 */
abstract class Expression extends Syntax {
  /**
   * The actual type of the expression determined by typechecking.
   */
  public concreteType!: Type;

  /**
   *
   * @param bindings generic type bindings.
   */
  public abstract substitute(bindings: TypeTable): Expression;

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
   * Some assignments (namely, assignments to an array's `len`) require a check.
   *
   * @param compiler the `compiler` managing register allocation, storage, etc.
   * @param dr the register holding the destination.
   * @param sr the register holding the source.
   */
  public compileAssignmentCheck(compiler: Compiler, dr: Register, ar: Register): void {}

  /**
   * Returns whether the code generated for this expression needs to include a dereference.
   *
   * @param lvalue whether this expression is being compield as an "lvalue".
   */
  protected dereference(lvalue?: boolean){
    return !lvalue && this.concreteType.integral;
  }

  /**
   * Whether the expression is assignable; this includes global and local
   * variables, index expressions, dot expressions, and dereference expressions.
   */
  public get assignable() {
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
writeOnce(Expression, 'concreteType');

class IdentifierExpression extends Expression {
  private qualifiedIdentifier!: string;
  private storage!: Storage;

  private instantiated: boolean = false;

  public constructor(private identifier: string, private typeArgs: Type[]){
    super();
  }

  public substitute(typeTable: TypeTable){
    return new IdentifierExpression(
      this.identifier,
      this.typeArgs.map((type) => type.substitute(typeTable)),
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const lookup = context.symbolTable.lookup(this.identifier);
    const declaration = context.namespace.lookupValue(context, this.identifier);

    let needsReference = false;
    let type: Type;
    let qualifiedIdentifier: string;
    if(lookup !== undefined){
      // First check for parameters and locals.
      this.storage = lookup.value.storage;
      qualifiedIdentifier = lookup.identity;
      type = lookup.value.type;
    }
    else if(declaration !== undefined){
      // Next check for globals, functions, and template functions.
      this.storage = declaration.storage;
      qualifiedIdentifier = declaration.qualifiedIdentifier;
      type = declaration.type;

      // Only globally-scoped identifiers need to be recorded for
      // liveness analysis.
      needsReference = true;
    }
    else {
      this.error(context, `unknown identifier ${this.identifier}`);
      return Type.Error;
    }

    const cType = type.resolve();

    // Explicitly instantiated template type.
    if(this.typeArgs.length){
      // Elaborate and check type arguments in this context.
      this.typeArgs.forEach((typeArg) => {
        typeArg.kindcheck(context, new KindChecker());
      });

      // Only templates can be instantiated.
      const cType = type.resolve();
      if(!(cType instanceof TemplateType)){
        this.error(context, `unexpected type arguments ${this.typeArgs.join(', ')}`);
        return Type.Error;
      }

      // We mangle the identifier in the same way as when we compile
      // each template instantiation so that when we compile the reference
      // to this function we will find it.
      const instantiatedType = cType.instantiate(context, new KindChecker(), this.typeArgs, this.location);
      this.qualifiedIdentifier = `${qualifiedIdentifier}<${instantiatedType}>`;
      if(needsReference){
        context.reference(this.qualifiedIdentifier);
      }

      return instantiatedType;
    }

    // Uninstantiated template type.
    if(cType instanceof TemplateType){
      // If we have an uninstantiated template, we must eventually instantiate
      // it or we won't be able to compile it.
      context.addCheck(() => {
        if(!this.instantiated){
          this.error(context, `${this} not instantiated`);
        }
      });

      // Once we instantiate this type, we need to record the mangled name
      // so we can emit it during compilation.
      return cType.extendInstantiators((ctx, k, instantiatedType: Type) => {
        this.instantiated = true;
        this.qualifiedIdentifier = `${qualifiedIdentifier}<${instantiatedType}>`;
        if(needsReference){
          context.reference(this.qualifiedIdentifier);
        }
      });
    }

    // Non-templated case.
    this.qualifiedIdentifier = qualifiedIdentifier;
    if(needsReference){
      context.reference(this.qualifiedIdentifier);
    }
    return type;
  }

  public compile(compiler: Compiler, lvalue: boolean): Register {
    const r = compiler.allocateRegister();

    // We only dereference when we are evaluating an integral.
    compiler.emitIdentifier(this.qualifiedIdentifier, this.storage, r, this.dereference(lvalue));
    return r;
  }

  public dereference(lvalue: boolean): boolean{
    if(this.storage === 'function'){
      return false;
    }
    return super.dereference(lvalue);
  }

  public get assignable() {
    return true;
  }

  public toString(){
    return this.identifier;
  }
}
writeOnce(IdentifierExpression, 'qualifiedIdentifier');
writeOnce(IdentifierExpression, 'storage');

class IntLiteralExpression extends Expression {
  public readonly immediate: Immediate;

  public constructor(immediate: Immediate){
    super();
    this.immediate = immediate;
  }

  public substitute(typeTable: TypeTable): Expression {
    return new IntLiteralExpression(
      this.immediate,
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextualType?: Type): Type {
    // If we contextually know we want a specific numeric type, let's use that.
    if(contextualType && contextualType.numeric){
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

class BoolLiteralExpression extends Expression {
  public readonly value: boolean;

  public constructor(value: boolean){
    super();
    this.value = value;
  }

  public substitute(typeTable: TypeTable): Expression {
    return new BoolLiteralExpression(this.value).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextualType?: Type): Type {
    // If we contextually know we want a specific numeric type, let's use that.
    if(contextualType && contextualType.numeric){
      return contextualType;
    }
    return context.builtinType('bool');
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

type LiteralExpression = {
  type: Type;
  expression?: Expression;
}

function compileLiteralExpressions(hint: string, compiler: Compiler, literalExpressions: readonly LiteralExpression[], length?: number): Register {
  // We can only compile non-integral literals when our compiler supports storage.
  if(!(compiler instanceof StorageCompiler)){
    throw new InternalError(`expected storage when compiling literal expression`);
  }

  const identifier = compiler.generateIdentifier(hint);

  // Allocate local storage; include 1 word for length header if length is specified.
  // New layout: [length][data...]
  let bytes = length === undefined ? 0 : 1;
  literalExpressions.forEach((literalExpression) => {
    bytes += literalExpression.type.size;
  });
  compiler.allocateStorage(identifier, bytes);

  const r = compiler.allocateRegister();
  const ri = compiler.allocateRegister();

  compiler.emitIdentifier(identifier, 'local', r, false);
  compiler.emitMove(ri, r, 'initialize destination pointer');

  // Emit the length header if specified.
  if(length !== undefined){
    const sr = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(sr, new ImmediateConstant(length)).comment(`length ${length}`),
    ]);
    compiler.emitStaticStore(ri, sr, 1, `store length`);
    compiler.emitIncrement(ri, 1, 'array[0]');
    compiler.deallocateRegister(sr);
  }

  // Evaluate each value (if there is one) and store it in the data.
  literalExpressions.forEach((literalExpression, i) => {
    if(literalExpression.expression !== undefined){
      const er = literalExpression.expression.compile(compiler);
      if(literalExpression.type.integral){
        compiler.emitStaticStore(ri, er, 1, 'store integral');
      }
      else {
        compiler.emitStaticCopy(ri, er, literalExpression.type.size, 'copy non-integral');
      }
      compiler.deallocateRegister(er);
    }
    else {
      const zr = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(zr, new ImmediateConstant(0)),
      ]);
      compiler.emitStaticStore(ri, zr, literalExpression.type.size);
      compiler.deallocateRegister(zr);
    }

    if(i < literalExpressions.length - 1){
      compiler.emitIncrement(ri, literalExpression.type.size, 'next literal expression');
    }
  });

  compiler.deallocateRegister(ri);

  return r;
}

class StringLiteralExpression extends Expression {
  public readonly codePoints: readonly number[];

  public constructor(public readonly text: string){
    super();
    this.codePoints = stringToCodePoints(this.text);
  }

  public substitute(typeTable: TypeTable): Expression {
    return new StringLiteralExpression(this.text).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    // Return a sized string.
    return new ArrayType(Type.Byte, this.codePoints.length);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const expressions = this.codePoints.map((c) => {
      const expression = new IntLiteralExpression(c);
      return {
        expression,
        type: Type.Byte,
      };
    });
    return compileLiteralExpressions('string_literal', compiler, expressions, this.length);
  }

  public get length(): number {
    return this.codePoints.length;
  }

  public toString(){
    return `'${TextData.escape(this.text)}'`;
  }
}

class ArrayLiteralExpression extends Expression {
  private expressions: Expression[];

  public constructor(expressions: Expression[]){
    super();
    this.expressions = expressions;
  }

  public substitute(typeTable: TypeTable): Expression {
    return new ArrayLiteralExpression(
      this.expressions.map((e) => e.substitute(typeTable)),
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextualType?: Type): Type {
    // Three cases: we have a contextual type, we have at least 1 expression, or we have neither.
    let elementType: Type | undefined;
    if(contextualType){
      const cType = contextualType.resolve();
      if(cType instanceof ArrayType){
        elementType = cType.index();
      }
      else if(cType instanceof SliceType){
        elementType = cType.index();
      }
      else {
        this.error(context, `expected contextual array or slice type, actual ${contextualType}`);
      }
    }

    // We don't need to typecheck the expressions if there are none.
    if(!this.expressions.length){
      if(!elementType){
        this.error(context, `expected contextual array type for empty array`);
        elementType = Type.Error;
      }
      return new SliceType(elementType);
    }

    // Each element of an array must have the same type; note that, similarly to
    // assignment, we allow conversion.
    const expression = this.expressions[0];
    const expressions = this.expressions.slice(1);

    // Check the first expression.
    const initialElementType = expression.typecheck(context);
    if(elementType && !elementType.isConvertibleTo(initialElementType)){
      this.error(context, `expected ${elementType}, actual ${initialElementType}`);
    }

    // Prefer the contextual type to the initial element.
    const actualElementType = elementType || initialElementType;

    // Check the rest of the expressions.
    expressions.forEach((expression) => {
      const actualType = expression.typecheck(context);
      if(!actualElementType.isConvertibleTo(actualType)){
        this.error(context, `expected ${actualElementType}, actual ${actualType}`);
      }
    });

    return new ArrayType(actualElementType, this.expressions?.length);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const type = (this.concreteType as ArrayType).index();
    const expressions = this.expressions.map((expression) => {
      return {
        expression,
        type,
      }
    });
    return compileLiteralExpressions('array_literal', compiler, expressions, expressions.length);
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
  expression: Expression,
}

type MemberExpression = {
  identifier: string,
  expression?: Expression,
  type: Type,
}

class StructLiteralExpression extends Expression {
  private memberExpressions!: readonly MemberExpression[];

  public constructor(
    private readonly type: Type,
    private readonly memberLiteralExpressions: readonly MemberLiteralExpression[]
  ){
    super();
  }

  public substitute(typeTable: TypeTable): Expression {
    return new StructLiteralExpression(
      this.type.substitute(typeTable),
      this.memberLiteralExpressions.map((m) => {
        return {
          identifier: m.identifier,
          expression: m.expression.substitute(typeTable)
        };
      }),
    ).at(this.location).tag(this.tags)
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    this.type.kindcheck(context, new KindChecker());

    const structType = this.type.resolve();
    if(structType instanceof StructType){
      // Ensure we have no duplicates.
      const identifiers = this.memberLiteralExpressions.map((m) => m.identifier);
      const duplicateIdentifiers = duplicates(identifiers);
      if(duplicateIdentifiers.length){
        this.error(context, `duplicate members ${duplicateIdentifiers.join(', ')}`);
      }

      // Check each member. Note that, similarly to assignment, we allow conversion. We
      // are allowed to skip members, so
      this.memberLiteralExpressions.forEach((member) => {
        const structMember = structType.member(member.identifier);
        if(structMember === undefined){
          this.error(context, `unknown member ${member.identifier}`);
          return;
        }
        const type = member.expression.typecheck(context, structMember.type);
        if(!structMember.type.isConvertibleTo(type)){
          this.error(context, `member ${member.identifier} expected ${structMember.type}, actual ${type}`);
        }
      });

      // Get the members in the correct order; since we are allowed to skip / reorder
      // them when initializing.
      this.memberExpressions = structType.members.map((member) => {
        const memberLiteralExpression = this.memberLiteralExpressions.find((memberLiteralExpression) => {
          return memberLiteralExpression.identifier === member.identifier;
        });
        return {
          identifier: member.identifier,
          expression: memberLiteralExpression?.expression,
          type: member.type,
        };
      });

      return this.type;
    }

    this.error(context, `expected struct type, actual ${this.type}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    return compileLiteralExpressions('struct_literal', compiler, this.memberExpressions);
  }

  public toString(){
    return `{ ${this.memberLiteralExpressions.map((m) => `${m.identifier} = ${m.expression}`).join(', ')} }`;
  }
}

class VoidExpression extends Expression {
  public substitute(typeTable: TypeTable): VoidExpression {
    return new VoidExpression().at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    if(contextual && contextual.isConvertibleTo(Type.Void)){
      return contextual;
    }
    return Type.Void;
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
    return `void`;
  }
}

class NullExpression extends Expression {
  public substitute(typeTable: TypeTable): NullExpression {
    return new NullExpression().at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    if(!contextual){
      this.error(context, `expected contextual pointer type for null`);
      return Type.Error;
    }

    const cType = contextual.resolve();
    if(cType instanceof PointerType){
      return contextual;
    }

    if(cType instanceof ArrayType){
      if(cType.length !== undefined){
        this.error(context, `expected contextual unsized array type for null, actual ${contextual}`);
      }
      return contextual;
    }

    this.error(context, `expected contextual pointer or unsized array type for null, actual ${contextual}`);
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

class SizeofExpression extends Expression {
  public constructor(
    private readonly type: Type,
  ){
    super();
  }

  public substitute(typeTable: TypeTable): SizeofExpression {
    return new SizeofExpression(
      this.type.substitute(typeTable),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    this.type.kindcheck(context, new KindChecker());
    return Type.Byte;
  }

  public constant(): number {
    return this.type.resolve().size;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(this.constant())).comment(`${this}`),
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
class NewExpression extends Expression {
  /**
   * When we construct a new expression for a named type, e.g.
   * `new state` where `type state = byte[32]`, we don't realize
   * that we are constructing a new array expression at parse time.
   * So, construct it at type-checking time and forward subsequent
   * calls to it.
   */
  private newArrayExpression?: NewArrayExpression;

  public constructor(
    /**
     * The type object being allocated; a pointer to this type
     * is returned by the expression.
     */
    private readonly type: Type,

    /**
     * Optional initialization expression.
     */
    private readonly expression?: Expression,

    /**
     * If this new expression actually represents a new[] expression,
     * we must forward the ellipsis value as well.
     */
    private readonly ellipsis: boolean = false,
  ){
    super();
  }

  public substitute(typeTable: TypeTable): Expression {
    if(this.newArrayExpression){
      return this.newArrayExpression.substitute(typeTable);
    }
    return new NewExpression(
      this.type.substitute(typeTable),
      this.expression ? this.expression.substitute(typeTable) : undefined,
      this.ellipsis,
    ).at(this.location);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    this.type.kindcheck(context, new KindChecker());

    const cType = this.type.resolve();
    if(cType instanceof ArrayType){
      // This should have been constructed as a new array expression, but we couldn't
      // see that at parse time.  The type *must* be a sized array or we won't
      // know how much memory to allocate.
      if(cType.length === undefined){
        this.error(context, `expected sized array type, actual ${this.type}`);
      }

      this.newArrayExpression = new NewArrayExpression(
        this.type,
        new IntLiteralExpression(cType.length || 0),
        this.expression,
        this.ellipsis,
      ).at(this.location);

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

      if(!this.type.isEqualTo(type)){
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
      new ConstantDirective(sr, new ImmediateConstant(this.type.size)).comment('new size'),
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
    if(this.type.integral || isZero){
      compiler.emitStaticStore(dr, er, this.type.size, 'initialize integral new');
    }
    else {
      compiler.emitStaticCopy(dr, er, this.type.size, 'initialize new');
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

class NewArrayExpression extends Expression {
  /**
   * The type of the elements of the array.
   */
  private elementType!: Type;

  public constructor(
    /**
     * The type of the expression itself.
     */
    private readonly type: Type,

    /**
     * An expression evaluating to the size of the array to be allocated.
     */
    private readonly size: Expression,
    /**
     * The initializer expression for the newly allocated memory.
     */
    private readonly expression: Expression | undefined,

    /**
     * Whether the initializing expression should be treated as the
     * value to initialize the entire array to (when `false`), or each
     * element to (when `true`).
     */
    private readonly ellipsis: boolean = false,
  ){
    super();
    this.type = type;
    this.size = size;
    this.expression = expression;
    this.ellipsis = ellipsis;
  }

  public substitute(typeTable: TypeTable): Expression {
    return new NewArrayExpression(
      this.type.substitute(typeTable),
      this.size.substitute(typeTable),
      this.expression ? this.expression.substitute(typeTable) : undefined,
      this.ellipsis,
    ).at(this.location);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    this.type.kindcheck(context, new KindChecker());

    // This type must be a slice (T[]).
    const cType = this.type.resolve();
    if(!(cType instanceof SliceType)){
      this.error(context, `new array expected slice type, actual ${this.type}`);
      return Type.Error;
    }
    this.elementType = cType.index();

    // Size should be a number.
    const sizeType = this.size.typecheck(context);
    if(!sizeType.numeric){
      this.error(context, `new array size expected numeric type, actual ${sizeType}`);
    }

    // If we've given the expression an initializer, typecheck it. Pass the
    // type contextually so that we can easily allocate arrays.
    if(this.expression){
      const compareType = this.ellipsis ? this.elementType : this.type;
      const type = this.expression.typecheck(context, compareType);

      if(!type.isEqualTo(compareType)){
        this.error(context, `new array initializer expected ${compareType}, actual ${type}`);
      }
    }

    // `new` returns a slice so that initializing a local variable with `new`
    // has the expected behavior:
    //
    //  var bytes = new byte[10] ... 5;
    //
    // Makes bytes have type `byte[]` (a slice), so that it is a 3-word
    // descriptor on the stack pointing to heap-allocated storage.
    return new SliceType(this.elementType);
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    // We need StorageCompiler to allocate the slice descriptor.
    if(!(compiler instanceof StorageCompiler)){
      throw new InternalError(`new[] requires StorageCompiler`);
    }

    // Compute the count (number of elements).
    const cr = this.size.compile(compiler); // Count.

    // Compute heap allocation size: (count * element_size) + 1 for the length header.
    const sr = compiler.allocateRegister(); // Storage size in words.
    if(this.elementType.size > 1){
      const mr = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(mr, new ImmediateConstant(this.elementType.size)).comment('new[]: element size'),
        new InstructionDirective(Instruction.createOperation(Operation.MUL, sr, cr, mr)).comment('new[]: data size'),
      ]);
      compiler.deallocateRegister(mr);
    }
    else {
      compiler.emitMove(sr, cr, 'new[]: data size');
    }

    // Add 1 for the length header.
    const tsr = compiler.allocateRegister();
    compiler.emitMove(tsr, sr);
    compiler.emitIncrement(tsr, 1, 'new[]: add length header');

    // Allocate the heap storage; this deallocates `tsr`.
    // Heap layout: [length][data...]
    const hr = compiler.emitNew(tsr, 'new[]');

    // Allocate stack storage for the slice descriptor (3 words: pointer, length, capacity).
    const sliceId = compiler.generateIdentifier('slice');
    compiler.allocateStorage(sliceId, 3);
    const sliceR = compiler.allocateRegister();
    compiler.emitIdentifier(sliceId, 'local', sliceR, false);

    // Handle allocation failure: if hr is null, store null slice and skip initialization.
    const endRef = compiler.generateReference('new_end');
    const initRef = compiler.generateReference('new_init');
    const endR = compiler.allocateRegister();
    const initR = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(endR, new ReferenceConstant(endRef)),
      new ConstantDirective(initR, new ReferenceConstant(initRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, hr, initR)),
      // Allocation failed: store null slice (all zeros).
      new ConstantDirective(endR, new ImmediateConstant(0)),
      new InstructionDirective(Instruction.createOperation(Operation.STORE, sliceR, endR)).comment('slice.pointer = null'),
    ]);
    compiler.emitIncrement(sliceR, 1);
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.STORE, sliceR, endR)).comment('slice.length = 0'),
    ]);
    compiler.emitIncrement(sliceR, 1);
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.STORE, sliceR, endR)).comment('slice.capacity = 0'),
      new ConstantDirective(endR, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, endR)),
      new LabelDirective(initRef),
    ]);
    compiler.deallocateRegister(endR);
    compiler.deallocateRegister(initR);

    // Initialize heap: set length header.
    compiler.emitStaticStore(hr, cr, 1, 'heap.length');

    // Data pointer is heap address + 1 (after length header).
    const dataR = compiler.allocateRegister();
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.ADD, dataR, hr, Compiler.ONE)).comment('data pointer'),
    ]);

    // Build the slice descriptor.
    // Reload slice address (it may have been clobbered).
    compiler.emitIdentifier(sliceId, 'local', sliceR, false);
    compiler.emitStaticStore(sliceR, dataR, 1, 'slice.pointer');
    compiler.emitIncrement(sliceR, 1);
    compiler.emitStaticStore(sliceR, cr, 1, 'slice.length');
    compiler.emitIncrement(sliceR, 1);
    compiler.emitStaticStore(sliceR, cr, 1, 'slice.capacity');

    // Now initialize the data.
    const adr = dataR; // Reuse dataR as address for initialization.

    // Write to destination.
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

    // Ellipsis means we are using the value represented by `er` multiple times.
    if(this.ellipsis || isZero){
      if(this.elementType.integral || isZero){
        compiler.emitDynamicStore(adr, er, sr, 'new[]: zero initialize');
      }
      else {
        this.compileStructuralEllipsis(compiler, adr, er, cr);
      }

      compiler.deallocateRegister(sr);
      compiler.deallocateRegister(adr);
      compiler.deallocateRegister(er);
      compiler.deallocateRegister(cr);
      compiler.deallocateRegister(hr);

      compiler.emit([
        new LabelDirective(endRef),
      ]);

      // Return pointer to slice descriptor.
      compiler.emitIdentifier(sliceId, 'local', sliceR, false);
      return sliceR;
    }

    // `er` is a pointer to an array (source for initialization).
    const esr = compiler.allocateRegister(); // Size of expression in bytes.
    const tr = compiler.allocateRegister(); // Temporary.

    // First load the size of the expression array in *elements*.
    // Array layout: [length][data...] - length at offset 0
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.LOAD, esr, er)).comment('new[]: source length'),
    ]);

    // Then multiply by element size if necessary to find the number of bytes to copy.
    if(this.elementType.size > 1){
      compiler.emit([
        new ConstantDirective(tr, new ImmediateConstant(this.elementType.size)).comment('new[]: source element size'),
        new InstructionDirective(Instruction.createOperation(Operation.MUL, esr, esr, tr)).comment('new[]: source all elements size'),
      ]);
    }

    // Find the beginning of the source array data.
    // Array layout: [length][data...] - data starts at offset 1
    compiler.emitIncrement(er, 1, 'new[]: source data');

    compiler.emitDynamicCopy(adr, er, sr, 'new[]: initialize');

    compiler.deallocateRegister(sr);
    compiler.deallocateRegister(adr);
    compiler.deallocateRegister(er);
    compiler.deallocateRegister(esr);
    compiler.deallocateRegister(tr);
    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(hr);

    // End, so we can jump here if memory allocation fails and we have nothing to initialize.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    // Return pointer to slice descriptor.
    compiler.emitIdentifier(sliceId, 'local', sliceR, false);
    return sliceR;
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

    compiler.emitStaticCopy(di, er, this.elementType.size, 'structural ellipsis');

    compiler.emitIncrement(di, this.elementType.size, 'increment index');
    compiler.emitIncrement(ci, 1, 'increment counter');
    // VM comparison ops return 0 for true (equal), 1 for false (not equal)
    // EQ(ci, cr) returns 0 when ci == cr (done), 1 when ci != cr (continue)
    // JNZ jumps when condition is non-zero, so it jumps when ci != cr (continue looping)
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
writeOnce(NewArrayExpression, 'elementType');

class CastExpression extends Expression {
  // Whether this cast extracts a pointer from a slice.
  private sliceToPointer: boolean = false;

  public constructor(
    private readonly type: Type,
    private readonly expression: Expression,
    private readonly unsafe: boolean = false,
  ){
    super();
  }

  public substitute(typeTable: TypeTable): CastExpression {
    return new CastExpression(
      this.type.substitute(typeTable),
      this.expression.substitute(typeTable),
      this.unsafe,
    ).at(this.location);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    this.type.kindcheck(context, new KindChecker());

    const type = this.expression.typecheck(context, this.type);

    // We can safely cast away nominal differences.
    if(this.type.isConvertibleTo(type)){
      if(this.unsafe){
        this.warning(context, `unnecessary unsafe cast between ${this.type} and ${type}`);
      }
      return this.type.tag(['.unsafe']);
    }

    // We can unsafely cast between integral types.
    if(this.type.integral && type.integral){
      if(!this.unsafe){
        this.error(context, `unsafe cast between ${this.type} and ${type}`);
      }
      return this.type;
    }

    // We can unsafely cast a slice to an integral type (extracts the data pointer).
    const cType = type.resolve();
    if(this.type.integral && cType instanceof SliceType){
      if(!this.unsafe){
        this.error(context, `unsafe cast between ${this.type} and ${type}`);
      }
      this.sliceToPointer = true;
      return this.type;
    }

    // Otherwise we can't.
    this.error(context, `expected convertible to ${this.type}, actual ${type}`);
    return this.type;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const r = this.expression.compile(compiler, lvalue);
    // If casting a slice to an integral, extract the data pointer (first word).
    if(this.sliceToPointer){
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, r, r)).comment('slice data pointer'),
      ]);
    }
    return r;
  }

  public toString(){
    return `<${this.type}>(${this.expression})`;
  }

  public constant(): Immediate | undefined {
    return this.expression.constant();
  }
}

type BinaryOperator =
  '+' | '-' | '*' | '/' | '%' |
  '&&' | '||' | '|' | '&' |
  '==' | '!=' | '<' | '<=' | '>' | '>=';

class BinaryExpression extends Expression {
  public constructor(
    public readonly operator: BinaryOperator,
    public readonly left: Expression,
    public readonly right: Expression,
  ){
    super();
  }

  public substitute(typeTable: TypeTable): BinaryExpression {
    return new BinaryExpression(
      this.operator,
      this.left.substitute(typeTable),
      this.right.substitute(typeTable),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const tLeft = this.left.typecheck(context);
    const tRight = this.right.typecheck(context, tLeft);

    switch(this.operator){
      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
      case '|':
      case '&': {
        // We can do arithmetic on numbers of the same type.
        if(!tLeft.numeric){
          this.error(context, `expected numeric type, actual ${tLeft}`);
        }
        if(!tRight.numeric){
          this.error(context, `expected numeric type, actual ${tRight}`);
        }
        if(!tLeft.isEqualTo(tRight)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }

        return tLeft;
      }

      case '&&':
      case '||': {
        // We can only treat integrals as truthy/falsy.
        if(!tLeft.integral){
          this.error(context, `expected integral type, actual ${tLeft}`);
        }
        if(!tRight.integral){
          this.error(context, `expected integral type, actual ${tRight}`);
        }

        // Both sides must have the same type.
        if(!tLeft.isEqualTo(tRight)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }

        return tLeft;
      }

      case '<':
      case '<=':
      case '>':
      case '>=':
        // We can only compare numerics.
        if(!tLeft.numeric){
          this.error(context, `expected numeric type, actual ${tLeft}`);
        }
        if(!tRight.numeric){
          this.error(context, `expected numeric type, actual ${tRight}`);
        }
        if(!tLeft.isEqualTo(tRight)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }
        return context.builtinType('bool');

      case '==':
      case '!=': {
        // We can only equate integrals.
        if(!tLeft.integral){
          this.error(context, `expected integral type, actual ${tLeft}`);
        }
        if(!tRight.integral){
          this.error(context, `expected integral type, actual ${tRight}`);
        }
        if(!tLeft.isEqualTo(tRight)){
          this.error(context, `expected ${tLeft}, actual ${tRight}`);
        }
        return context.builtinType('bool');
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
      '|': Operation.OR,
      '&': Operation.AND,
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

type UnaryOperator = '-' | '+' | '*' | '&' | '!' | 'len' | 'capacity';

class UnaryExpression extends Expression {
  public constructor(
    private readonly operator: UnaryOperator,
    private readonly expression: Expression,
  ){
    super();
  }

  public substitute(typeTable: TypeTable): UnaryExpression {
    return new UnaryExpression(
      this.operator,
      this.expression.substitute(typeTable),
    )
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const type = this.expression.typecheck(context);

    switch(this.operator){
      case '+':
      case '-': {
        if(type.numeric){
          return type;
        }

        this.error(context, `expected numeric type, actual ${type}`);
        return Type.Byte;
      }
      case '!': {
        if(!type.integral){
          this.error(context, `expected integral type, actual ${type}`);
        }
        return context.builtinType('bool');
      }

      case '*': {
        const cType = type.resolve();

        if(cType.err){
          return cType;
        }

        if(cType instanceof PointerType){
          return cType.dereference();
        }

        this.error(context, `expected pointer type, actual ${type}`);
        return Type.Error;
      }
      case '&': {
        // We can't take the address of void.
        if(type.isConvertibleTo(Type.Void)){
          this.error(context, `expected non-void type, actual ${type}`);
        }

        // We can't take the address of something that isn't assignable.
        if(!this.expression.assignable){
          this.error(context, `expected assignable expression`);
        }

        // Otherwise we can take the address of anything,
        // and we know that the pointer is not null.
        return new PointerType(type).tag(['.notnull']);
      }

      case 'len':
      case 'capacity': {
        const cType = type.resolve();
        if(!(cType instanceof ArrayType) && !(cType instanceof SliceType)){
          this.error(context, `expected array or slice type, actual ${type}`);
        }
        return Type.Byte;
      }
      default:
        throw new InternalError(`unexpected unary operator ${this.operator}`);
    }
  }

  public get assignable() {
    // Dereferences are assignable.
    if(this.operator === '*'){
      return true;
    }

    // `len x` is assignable as like writing to x[-1], basically.
    if(this.operator === 'len'){
      return true;
    }

    return false;
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

      case '*': {
        // Compile the nested value as an rvalue.
        const r = this.expression.compile(compiler, false);

        // TODO: eliminate this check when possible.
        compiler.emitNullCheck(r);

        // Not all expressions of the form `*e` must be dereferenced. For instance,
        // if `e` is an identifier refering to a struct, then `e` is already the address
        // of the struct.
        if(this.dereference(lvalue)){
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

      case 'capacity': {
        const exprType = this.expression.concreteType.resolve();
        const er = this.expression.compile(compiler);

        if(exprType instanceof ArrayType){
          // Array capacity is a compile-time constant (the array's declared length).
          compiler.emit([
            new ConstantDirective(er, new ImmediateConstant(exprType.length)).comment(`array capacity ${exprType.length}`),
          ]);
        }
        else if(exprType instanceof SliceType){
          // Slice layout: [pointer][length][capacity] - capacity at offset 2
          compiler.emitIncrement(er, 2, 'slice capacity offset');
          if(this.dereference(lvalue)){
            compiler.emit([
              new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er)).comment(`${this}`),
            ]);
          }
        }
        return er;
      }
      case 'len': {
        const exprType = this.expression.concreteType.resolve();
        const er = this.expression.compile(compiler);

        if(exprType instanceof ArrayType){
          // Array layout: [length][data...] - length at offset 0
          // No offset needed, just load
        }
        else if(exprType instanceof SliceType){
          // Slice layout: [pointer][length][capacity] - length at offset 1
          compiler.emitIncrement(er, 1, 'slice length offset');
        }

        if(this.dereference(lvalue)){
          compiler.emit([
            new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er)).comment(`${this}`),
          ]);
        }
        return er;
      }
      default:
        throw new InternalError(`unexpected unary operator ${this.operator}`);
    }
  }

  public compileAssignmentCheck(compiler: Compiler, lr: Register, vr: Register): void {
    switch(this.operator){
      case 'len': {
        const exprType = this.expression.concreteType.resolve();

        if(exprType instanceof ArrayType){
          // Array capacity is a compile-time constant.
          // Check: vr <= capacity (i.e., vr > capacity is an error)
          const endRef = compiler.generateReference('capacity_check_end');
          const cr = compiler.allocateRegister();
          const er = compiler.allocateRegister();
          compiler.emit([
            new ConstantDirective(cr, new ImmediateConstant(exprType.length)).comment(`array capacity ${exprType.length}`),
            new InstructionDirective(Instruction.createOperation(Operation.GT, cr, vr, cr)).comment('compare capacity with new len'),
            new ConstantDirective(er, new ReferenceConstant(endRef)),
            new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, cr, er)),
            new ConstantDirective(Compiler.RET, new ImmediateConstant(Compiler.CAPACITY_ERROR)).comment('capacity error'),
            new InstructionDirective(Instruction.createOperation(Operation.HALT)),
            new LabelDirective(endRef),
          ]);
          compiler.deallocateRegister(cr);
          compiler.deallocateRegister(er);
        }
        else if(exprType instanceof SliceType){
          // Slice layout: [pointer][length][capacity]
          // lr is the address of length (offset 1 from slice base)
          // Capacity is at offset 2, which is lr + 1
          const ar = compiler.allocateRegister();
          compiler.emit([
            new InstructionDirective(Instruction.createOperation(Operation.ADD, ar, lr, Compiler.ONE)).comment('get slice capacity address'),
          ]);
          compiler.emitCapacityCheck(ar, vr);
          compiler.deallocateRegister(ar);
        }
        break;
      }
      default:
        break;
    }
    return;
  }

  public toString(){
    return `${this.operator}(${this.expression})`;
  }
}

class CallExpression extends Expression {
  private functionType!: FunctionType;

  public constructor(
    private readonly expression: Expression,
    private readonly argumentExpressions: readonly Expression[],
  ){
    super();
  }

  public substitute(typeTable: TypeTable): Expression {
    return new CallExpression(
      this.expression.substitute(typeTable),
      this.argumentExpressions.map((expression) => {
        return expression.substitute(typeTable);
      }),
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const type = this.expression.typecheck(context);

    const cType = type.resolve();

    if(cType.err){
      return cType;
    }

    if(cType instanceof TemplateType){
      const argumentTypes = this.argumentExpressions.map((argumentExpression) => {
        return argumentExpression.typecheck(context);
      });
      const returnType = contextual || new VariableType();
      const expectedType = new FunctionType(
        argumentTypes,
        returnType,
      ).at(this.location);

      const inferredType = cType.infer(context, new KindChecker(), expectedType, this.location);
      if(!inferredType){
        this.error(context, `unable to infer template instantiation, actual ${type}`);
        return Type.Error;
      }
      if(!(inferredType instanceof FunctionType)){
        this.error(context, `expected function type, actual ${inferredType}`);
        return Type.Error;
      }

      this.functionType = inferredType;
      return inferredType.returnType;
    }

    if(cType instanceof FunctionType){
      if(this.argumentExpressions.length !== cType.arity){
        this.error(context, `expected ${cType.arity} arguments, actual ${this.argumentExpressions.length}`);
      }

      // Check each argument's type.
      this.argumentExpressions.forEach((argumentExpression, i) => {
        const expectedType = cType.argumentTypes[i];
        const argumentType = argumentExpression.typecheck(context, expectedType);

        // Don't raise an error if we passed too many arguments here, we
        // already did above.
        if(expectedType && !argumentType.isConvertibleTo(expectedType)){
          this.error(context, `expected ${expectedType}, actual ${argumentType}`);
        }
      });

      // The resulting type is the function's return type.
      this.functionType = cType;
      return cType.returnType;
    }

    this.error(context, `expected function type, actual ${type}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    // Compile the target location of the function to call.
    const tr = this.expression.compile(compiler, lvalue);

    // TODO: remove this when possible.
    compiler.emitNullCheck(tr);

    // Compile the arguments.
    const args = this.argumentExpressions.map((argumentExpression, i) => {
      const expectedType = this.functionType.argumentTypes[i].resolve();
      const actualType = argumentExpression.concreteType.resolve();
      let r = argumentExpression.compile(compiler, lvalue);

      // Handle array-to-slice conversion.
      if (expectedType instanceof SliceType && actualType instanceof ArrayType) {
        r = this.compileArrayToSliceConversion(compiler, r);
      }

      return {
        register: r,
        size: expectedType.size,
        integral: expectedType.integral,
      };
    });

    // If this function call returns a non-integral value (e.g. a struct)
    // then we allocate storage for it in the current frame and pass the
    // address of this storage as the first argument. Then when we
    // compile return statements that return non-integral values, we write
    // to this location.
    if(!this.functionType.returnType.integral && !this.functionType.returnType.isConvertibleTo(Type.Void)){
      if(!(compiler instanceof StorageCompiler)){
        throw new InternalError(`expected storage when compiling non-integral return`);
      }
      const identifier = compiler.generateIdentifier('return');
      compiler.allocateStorage(identifier, this.functionType.returnType.size);
      const r = compiler.allocateRegister();
      compiler.emitIdentifier(identifier, 'local', r, false);
      args.unshift({
        register: r,
        size: 1,
        integral: true,
      });
    }

    // Compile the call; this deallocates the argument and target registers.
    return compiler.emitCall(args, tr);
  }

  /**
   * Converts an array address to a slice descriptor.
   * Array layout: [length][data...]
   * Slice layout: [pointer][length][capacity]
   */
  private compileArrayToSliceConversion(compiler: Compiler, arrayReg: Register): Register {
    if (!(compiler instanceof StorageCompiler)) {
      throw new InternalError('expected storage compiler for slice conversion');
    }

    // Allocate temporary storage for slice descriptor (3 words).
    const tempId = compiler.generateIdentifier('slice_temp');
    compiler.allocateStorage(tempId, 3);

    const sliceReg = compiler.allocateRegister();
    compiler.emitIdentifier(tempId, 'local', sliceReg, false);

    // Store pointer: array address + 1 (skip length header).
    const ptrReg = compiler.allocateRegister();
    compiler.emit([
      new InstructionDirective(
        Instruction.createOperation(Operation.ADD, ptrReg, arrayReg, Compiler.ONE)
      ).comment('slice.pointer = array + 1'),
    ]);
    compiler.emitStaticStore(sliceReg, ptrReg, 1, 'slice.pointer');
    compiler.deallocateRegister(ptrReg);

    // Load array length and store as slice length and capacity.
    const lenReg = compiler.allocateRegister();
    compiler.emit([
      new InstructionDirective(
        Instruction.createOperation(Operation.LOAD, lenReg, arrayReg)
      ).comment('load array length'),
    ]);

    compiler.emitIncrement(sliceReg, 1);
    compiler.emitStaticStore(sliceReg, lenReg, 1, 'slice.length');
    compiler.emitIncrement(sliceReg, 1);
    compiler.emitStaticStore(sliceReg, lenReg, 1, 'slice.capacity');
    compiler.deallocateRegister(lenReg);

    // Reset slice register to point to start of descriptor.
    compiler.emitIdentifier(tempId, 'local', sliceReg, false);

    // Deallocate the original array register.
    compiler.deallocateRegister(arrayReg);

    return sliceReg;
  }

  public toString(){
    const args = this.argumentExpressions.join(', ');
    return `${this.expression}(${args})`;
  }
}
writeOnce(CallExpression, 'argumentTypes');

type Suffix = {
  index?: Expression;
  unsafe?: boolean;
  identifier?: string;
  pointer?: boolean;
  expressions?: readonly Expression[];
  isSlice?: boolean;
  lo?: Expression;
  hi?: Expression;
  range: IFileRange;
  text: string;
  options?: IParseOptions
};

abstract class SuffixExpression extends Expression {
  public constructor(
    public readonly expression: Expression,
  ){
    super();
  }

  public get assignable() {
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
      if(suffix.isSlice){
        return new SliceExpression(expression, suffix.lo, suffix.hi).at(suffix.range, suffix.text, suffix.options);
      }
      if(suffix.index !== undefined){
        return new IndexExpression(expression, suffix.index, suffix.unsafe).at(suffix.range, suffix.text, suffix.options);
      }
      if(suffix.expressions !== undefined){
        return new CallExpression(expression, suffix.expressions).at(suffix.range, suffix.text, suffix.options);
      }
      throw new InternalError('invalid suffix');
    }, expression);
  }

  public static createIndex(index: Expression, unsafe: boolean, range: IFileRange, text: string, options?: IParseOptions): Suffix {
    return { index, unsafe, range, text, options };
  }

  public static createMember(identifier: string, pointer: boolean, range: IFileRange, text: string, options?: IParseOptions): Suffix {
    return { identifier, pointer, range, text, options };
  }

  public static createCall(expressions: readonly Expression[], range: IFileRange, text: string, options?: IParseOptions): Suffix {
    return { expressions, range, text, options };
  }

  public static createSlice(lo: Expression | undefined, hi: Expression | undefined, range: IFileRange, text: string, options?: IParseOptions): Suffix {
    return { isSlice: true, lo, hi, range, text, options };
  }
}

class DotExpression extends SuffixExpression {
  private offset!: number;

  public constructor(
    expression: Expression,
    public readonly identifier: string,
  ){
    super(expression);
  }

  public substitute(typeTable: TypeTable): DotExpression {
    return new DotExpression(
      this.expression.substitute(typeTable),
      this.identifier,
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve();

    if(cType.err){
      return cType;
    }

    if(cType instanceof StructType){
      const member = cType.member(this.identifier);
      if(member !== undefined){
        // Store index for later use during compilation.
        this.offset = cType.offset(this.identifier)
        return member.type;
      }
      this.error(context, `struct type ${type} has no member ${this.identifier}`);
      return Type.Error;
    }

    this.error(context, `expected struct type, actual ${type}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const er = this.expression.compile(compiler);

    compiler.emitIncrement(er, this.offset, `.${this.identifier}`);

    // We only dereference when we are evaluating an integral, e.g. `point.x` when
    // `x` is a byte.
    if(this.dereference(lvalue)){
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
writeOnce(DotExpression, 'offset');

class ArrowExpression extends SuffixExpression {
  private offset!: number;

  public constructor(
    expression: Expression,
    public readonly identifier: string,
  ){
    super(expression);
  }

  public substitute(typeTable: TypeTable): Expression {
    return new ArrowExpression(
      this.expression.substitute(typeTable),
      this.identifier,
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve();

    if(cType.err){
      return cType;
    }

    if(!(cType instanceof PointerType)){
      this.error(context, `expected pointer to struct type, actual ${type}`);
      return Type.Error;
    }

    const structType = cType.dereference().resolve();
    if(!(structType instanceof StructType)){
      this.error(context, `expected pointer to struct type, actual ${type}`);
      return Type.Error;
    }

    const member = structType.member(this.identifier);
    if(member !== undefined){
      // Store index for later use during compilation.
      this.offset = structType.offset(this.identifier);
      return member.type;
    }

    this.error(context, `invalid identifier ${this.identifier}`);
    return Type.Error;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const er = this.expression.compile(compiler);

    // TODO: remove when not null.
    compiler.emitNullCheck(er);

    // We only need to adjust our pointer when we are indexing into the object;
    // if we are referencing the first value, we don't need to.
    compiler.emitIncrement(er, this.offset, `->${this.identifier}`);

    // We only dereference when we are evaluating an integral, e.g. `point->x` when
    // `x` is a byte.
    if(this.dereference(lvalue)){
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
writeOnce(ArrowExpression, 'offset');

class IndexExpression extends SuffixExpression {
  private stride!: number;

  public constructor(
    expression: Expression,
    public readonly index: Expression,
    public readonly unsafe: boolean = false,
  ){
    super(expression);
  }

  public substitute(typeTable: TypeTable): Expression {
    return new IndexExpression(
      this.expression.substitute(typeTable),
      this.index.substitute(typeTable),
      this.unsafe,
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve();
    const indexType = this.index.typecheck(context);

    let elementType;
    if(cType instanceof ArrayType){
      elementType = cType.index();
    }
    else if(cType instanceof SliceType){
      elementType = cType.index();
    }
    else if(cType instanceof PointerType) {
      if(!this.unsafe){
        this.error(context, `unsafe index on ${type}`);
      }
      elementType = cType.dereference();
    }
    else if(cType === Type.Error){
      // Shhhh....
      elementType = Type.Error;
    }
    else {
      this.error(context, `expected array, slice, or pointer type, actual ${type}`);
      return Type.Error;
    }

    // We can only index by a numeric type.
    if(!indexType.numeric){
      this.error(context, `index expected numeric type, actual ${type}`);
    }

    // We may have an invalid type for which we cannot compute a size;
    // in this case we'll have already recorded an error.
    try {
      this.stride = elementType.size;
    }
    catch(e){}
    return elementType;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    const er = this.expression.compile(compiler);
    const ir = this.index.compile(compiler);

    // If the expression is a pointer, we should check that it is not null.
    if(this.unsafe){
      compiler.emitNullCheck(er);
    }

    // If the expression is an array or slice, we should insert bounds checks.
    // Array layout: [length][data...] - length at offset 0
    // Slice layout: [pointer][length][capacity] - length at offset 1
    const exprType = this.expression.concreteType.resolve();
    if(exprType instanceof ArrayType && !this.unsafe){
      compiler.emitBoundsCheck(er, ir, 0);
    }
    else if(exprType instanceof SliceType && !this.unsafe){
      compiler.emitBoundsCheck(er, ir, 1);
    }

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

    // For arrays: skip the length header (1 word) to get to data.
    // For slices: load the pointer (first word) which points directly to data.
    if(exprType instanceof ArrayType){
      compiler.emitIncrement(er, 1, 'array data start');
    }
    else if(exprType instanceof SliceType){
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, er, er)).comment('slice data pointer'),
      ]);
    }

    // Then we add the actual offset to the data pointer.
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.ADD, er, er, ir)),
    ]);

    // Dereference if required.
    if(this.dereference(lvalue)){
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

/**
 * Slice expression: x[lo:hi] creates a new slice from an array or slice.
 * - lo defaults to 0 if omitted
 * - hi defaults to len(x) if omitted
 */
class SliceExpression extends SuffixExpression {
  private stride!: number;

  public constructor(
    expression: Expression,
    public readonly lo: Expression | undefined,
    public readonly hi: Expression | undefined,
  ){
    super(expression);
  }

  public substitute(typeTable: TypeTable): Expression {
    return new SliceExpression(
      this.expression.substitute(typeTable),
      this.lo?.substitute(typeTable),
      this.hi?.substitute(typeTable),
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    const type = this.expression.typecheck(context);
    const cType = type.resolve();

    let elementType: Type;
    if(cType instanceof ArrayType){
      elementType = cType.index();
    }
    else if(cType instanceof SliceType){
      elementType = cType.index();
    }
    else if(cType === Type.Error){
      elementType = Type.Error;
    }
    else {
      this.error(context, `expected array or slice type, actual ${type}`);
      return Type.Error;
    }

    // Typecheck lo and hi if present.
    if(this.lo){
      const loType = this.lo.typecheck(context);
      if(!loType.numeric){
        this.error(context, `slice lo index expected numeric type, actual ${loType}`);
      }
    }
    if(this.hi){
      const hiType = this.hi.typecheck(context);
      if(!hiType.numeric){
        this.error(context, `slice hi index expected numeric type, actual ${hiType}`);
      }
    }

    try {
      this.stride = elementType.size;
    }
    catch(e){}

    // Result is always a slice.
    return new SliceType(elementType).at(this.location);
  }

  public get assignable() {
    return false;
  }

  public compile(compiler: Compiler, lvalue?: boolean): Register {
    // We need StorageCompiler to allocate the slice descriptor.
    if(!(compiler instanceof StorageCompiler)){
      throw new InternalError(`slice expression requires StorageCompiler`);
    }

    const exprType = this.expression.concreteType.resolve();

    // Allocate result registers for the slice: [pointer][length][capacity]
    const pr = compiler.allocateRegister(); // pointer
    const lr = compiler.allocateRegister(); // length
    const cr = compiler.allocateRegister(); // capacity

    // Compile lo (default to 0)
    let loR: Register;
    if(this.lo){
      loR = this.lo.compile(compiler);
    }
    else {
      loR = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(loR, new ImmediateConstant(0)).comment('slice lo default 0'),
      ]);
    }

    // Compile hi (or defer to use length)
    let hiR: Register | undefined;
    if(this.hi){
      hiR = this.hi.compile(compiler);
    }

    const er = this.expression.compile(compiler);

    if(exprType instanceof ArrayType){
      // Array layout: [length][data...]
      // Load original length for bounds/capacity calculation.
      const origLenR = compiler.allocateRegister();
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, origLenR, er)).comment('array length'),
      ]);

      // If hi is not provided, use original length.
      if(!hiR){
        hiR = compiler.allocateRegister();
        compiler.emit([
          new InstructionDirective(Instruction.createOperation(Operation.MOV, hiR, origLenR)).comment('slice hi default len'),
        ]);
      }

      // Compute length = hi - lo.
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.SUB, lr, hiR, loR)).comment('slice length = hi - lo'),
      ]);

      // Compute capacity = origLen - lo.
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.SUB, cr, origLenR, loR)).comment('slice capacity = len - lo'),
      ]);

      // Compute pointer = er + 1 + lo * stride (pointing to data[lo]).
      compiler.emitIncrement(er, 1, 'skip array length header');
      if(this.stride > 1){
        const sr = compiler.allocateRegister();
        compiler.emit([
          new ConstantDirective(sr, new ImmediateConstant(this.stride)).comment(`stride ${this.stride}`),
          new InstructionDirective(Instruction.createOperation(Operation.MUL, loR, loR, sr)).comment('lo offset'),
        ]);
        compiler.deallocateRegister(sr);
      }
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.ADD, pr, er, loR)).comment('slice pointer'),
      ]);

      compiler.deallocateRegister(origLenR);
    }
    else if(exprType instanceof SliceType){
      // Slice layout: [pointer][length][capacity]
      const origPtrR = compiler.allocateRegister();
      const origCapR = compiler.allocateRegister();

      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, origPtrR, er)).comment('slice pointer'),
      ]);
      compiler.emitIncrement(er, 1, 'slice length offset');
      const origLenR = compiler.allocateRegister();
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, origLenR, er)).comment('slice length'),
      ]);
      compiler.emitIncrement(er, 1, 'slice capacity offset');
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, origCapR, er)).comment('slice capacity'),
      ]);

      // If hi is not provided, use original length.
      if(!hiR){
        hiR = compiler.allocateRegister();
        compiler.emit([
          new InstructionDirective(Instruction.createOperation(Operation.MOV, hiR, origLenR)).comment('slice hi default len'),
        ]);
      }

      // Compute length = hi - lo.
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.SUB, lr, hiR, loR)).comment('slice length = hi - lo'),
      ]);

      // Compute capacity = origCap - lo.
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.SUB, cr, origCapR, loR)).comment('slice capacity = cap - lo'),
      ]);

      // Compute pointer = origPtr + lo * stride.
      if(this.stride > 1){
        const sr = compiler.allocateRegister();
        compiler.emit([
          new ConstantDirective(sr, new ImmediateConstant(this.stride)).comment(`stride ${this.stride}`),
          new InstructionDirective(Instruction.createOperation(Operation.MUL, loR, loR, sr)).comment('lo offset'),
        ]);
        compiler.deallocateRegister(sr);
      }
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.ADD, pr, origPtrR, loR)).comment('slice pointer'),
      ]);

      compiler.deallocateRegister(origPtrR);
      compiler.deallocateRegister(origCapR);
      compiler.deallocateRegister(origLenR);
    }

    compiler.deallocateRegister(loR);
    if(hiR){
      compiler.deallocateRegister(hiR);
    }
    compiler.deallocateRegister(er);

    // Allocate stack storage for the slice descriptor (3 words: pointer, length, capacity).
    const sliceId = compiler.generateIdentifier('slice');
    compiler.allocateStorage(sliceId, 3);
    const sliceR = compiler.allocateRegister();
    compiler.emitIdentifier(sliceId, 'local', sliceR, false);

    // Store the slice values.
    compiler.emitStaticStore(sliceR, pr, 1, 'slice.pointer');
    compiler.emitIncrement(sliceR, 1);
    compiler.emitStaticStore(sliceR, lr, 1, 'slice.length');
    compiler.emitIncrement(sliceR, 1);
    compiler.emitStaticStore(sliceR, cr, 1, 'slice.capacity');

    compiler.deallocateRegister(pr);
    compiler.deallocateRegister(lr);
    compiler.deallocateRegister(cr);

    // Return the address of the slice descriptor.
    compiler.emitIdentifier(sliceId, 'local', sliceR, false);
    return sliceR;
  }

  public toString(){
    const lo = this.lo?.toString() ?? '';
    const hi = this.hi?.toString() ?? '';
    return `(${this.expression})[${lo}:${hi}]`;
  }
}
writeOnce(SliceExpression, 'stride');

class ConditionalExpression extends Expression {
  public constructor(
    private readonly condition: Expression,
    private readonly ifExpression: Expression,
    private readonly elseExpression: Expression,
  ){
    super();
  }

  public substitute(typeTable: TypeTable){
    return new ConditionalExpression(
      this.condition.substitute(typeTable),
      this.ifExpression.substitute(typeTable),
      this.elseExpression.substitute(typeTable),
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker, contextual?: Type): Type {
    // A conditional's `condition` should be a type that is valid in a boolean context.
    const conditionType = this.condition.typecheck(context);
    if(!conditionType.integral){
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    // Each branch of the conditional should have the same type.
    const ifType = this.ifExpression.typecheck(context);
    const elseType = this.elseExpression.typecheck(context);
    if(!ifType.isEqualTo(elseType)){
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

[ IdentifierExpression,
  IntLiteralExpression, StringLiteralExpression, BoolLiteralExpression,
  BinaryExpression, UnaryExpression,
  CallExpression,
  DotExpression, ArrowExpression, IndexExpression, SliceExpression, SuffixExpression,
  ConditionalExpression,
  CastExpression, NewExpression, NewArrayExpression,
  NullExpression, VoidExpression,
  ArrayLiteralExpression, StructLiteralExpression,
  SizeofExpression,
].forEach((expressionClass) => {
  const typecheck = expressionClass.prototype.typecheck;
  expressionClass.prototype.typecheck = function(this: Expression, context: TypeChecker, contextual?: Type): Type {
    const type = typecheck.call(this, context, contextual);
    this.concreteType = type.resolve();
    return type;
  };
});

export {
  Expression,
  IdentifierExpression,
  IntLiteralExpression, StringLiteralExpression, BoolLiteralExpression,
  BinaryExpression, UnaryExpression,
  CallExpression,
  DotExpression, ArrowExpression, IndexExpression, SliceExpression, SuffixExpression,
  ConditionalExpression,
  CastExpression, NewExpression, NewArrayExpression,
  NullExpression, VoidExpression,
  ArrayLiteralExpression, StructLiteralExpression,
  SizeofExpression,
};
