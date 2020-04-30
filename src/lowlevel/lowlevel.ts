import { InternalError, logger, Messages, indent, parseFile } from '../lib/util';
import {
  Directive,

  ConstantDirective, ImmediateConstant, ReferenceConstant,
  DataDirective, TextData, ImmediatesData, ReferenceData,
  InstructionDirective,
  LabelDirective,

  Reference,

  AssemblyProgram,
} from '../assembly/assembly';
import { VM } from '../vm/vm';
import { Instruction, Operation } from '../vm/instructions';
import { Type, TypedIdentifier, TypedStorage, FunctionType } from './types';
import { Expression, StringLiteralExpression, IntLiteralExpression } from './expressions';
import { BlockStatement } from './statements';
import { TypeChecker, KindChecker } from './typechecker';
import { mixin, HasTags, HasLocation } from '../lib/util';
import { Compiler, FunctionCompiler, InterruptCompiler, GlobalCompiler } from './compiler';
import { parse } from './parser';

const log = logger('lowlevel');

///////////////////////////////////////////////////////////////////////
// Declarations.
///////////////////////////////////////////////////////////////////////
abstract class Declaration extends mixin(HasTags, HasLocation) {
  protected constructor(protected identifier: string, protected qualifiedIdentifier?: string){
    super();
  }

  /**
   * A first pass over type-level objects that constructs
   * the type table for the program.  This allows us to
   * create recursive types without pre-declaring types.
   *
   * @param context the type checking context.
   */
  public preKindcheck(context: TypeChecker): void {};

  /**
   * A second pass over type-level objects that verifies
   * that each type is valid.  This ensures that e.g. all
   * identifiers resolve to a type.
   *
   * @param context the type checking context.
   */
  public kindcheck(context: TypeChecker): void {};

  /**
   * A first pass over value-level objects that constructs
   * a symbol table for the program. This allows us to e.g.
   * call recursive functions without pre-declarations.
   *
   * @param context the type checking context.
   */
  public preTypecheck(context: TypeChecker): void {};

  /**
   * A second pass over value-level objects that verifies
   * type correctness. This the "real" typechecking pass.
   *
   * @param context the type checking context.
   */
  public typecheck(context: TypeChecker): void {};

  /**
   * Returns all of the declarations found within
   * this declaration, including the declaration itself.
   */
  public get allDeclarations(): Declaration[] {
    return [ this ];
  }
}
interface Declaration extends HasTags, HasLocation {}

/**
 * A new type declaration. For now type declarations cannot
 * be "abstract".
 */
class TypeDeclaration extends Declaration {
  private type: Type;

  public constructor(identifier: string, type: Type, tags: string[]){
    super(identifier);
    this.type = type;
    this.tag(tags);
  }

  public preKindcheck(context: TypeChecker): void {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.typeTable.set(this.qualifiedIdentifier, this.type);
  }

  public kindcheck(context: TypeChecker): void {
    if(!this.qualifiedIdentifier){
      throw new InternalError(`${this} has not been pre-kindchecked`);
    }
    this.type.kindcheck(context, new KindChecker().visit(this.qualifiedIdentifier));
  }

  public toString(){
    return this.withTags(`type ${this.identifier} = ${this.type};`);
  }
}

/**
 * A global value declaration. Globals can either be pre-declarations,
 * which do not have an initializing expression, or declarations proper,
 * which do.
 */
class GlobalDeclaration extends Declaration {
  private type: Type;
  private expression?: Expression;

  public constructor(identifier: string, type: Type, tags: string[], expression?: Expression){
    super(identifier);
    this.type = type;
    this.expression = expression;

    this.tag(tags);
  }

  public kindcheck(context: TypeChecker){
    this.type.kindcheck(context, new KindChecker());
  }

  public preTypecheck(context: TypeChecker): void {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.symbolTable.set(this.qualifiedIdentifier, new TypedStorage(this.type, 'global'));
  }

  public typecheck(context: TypeChecker){
    // Pre-declarations don't need typechecking; we assume that the module
    // that actually declares them is already typechecked and that the
    // pre-declaration is correct.
    if(this.expression){
      const type = this.expression.typecheck(context, this.type);
      if(!this.type.isConvertibleTo(type, context)){
        this.error(context, `expected ${this.type}, actual ${type}`)
      }
    }
  }

  public compile(): Directive[] {
    if(this.qualifiedIdentifier === undefined){
      throw new InternalError(`${this} has not been pre-typechecked`);
    }

    // Global pre-declarations aren't compiled.
    if(!this.expression){
      return [];
    }

    const reference = new Reference(this.qualifiedIdentifier);

    // We can make a nice string in the assembly by special-casing string literals.
    if(this.expression instanceof StringLiteralExpression){
      const temporaryReference = new Reference(`${this.qualifiedIdentifier}_string$`);
      return [
        new DataDirective(temporaryReference, new TextData(this.expression.text)),
        new DataDirective(reference, new ReferenceData(temporaryReference)),
      ];
    }

    // We can skip some moves and stores by special-casing constant values.
    const constant = this.expression.constant();
    if(constant !== undefined){
      return [
        new DataDirective(reference, new ImmediatesData([ constant ])),
      ];
    }

    // Otherwise, we make a global destination to compile this expression to and
    // populate it.
    const compiler = new GlobalCompiler(this.qualifiedIdentifier);
    const sr = this.expression.compile(compiler);
    const dr = compiler.allocateRegister();

    compiler.emit([
      new ConstantDirective(dr, new ReferenceConstant(reference)).comment(`reference global ${this.qualifiedIdentifier}`),
    ])
    if(this.type.concreteType.isIntegral()){
      compiler.emitStaticStore(dr, sr, 1, `store to global ${this.qualifiedIdentifier}`);
    }
    else {
      compiler.emitStaticCopy(dr, sr, this.type.concreteType.size, `store to global ${this.qualifiedIdentifier}`);
    }

    return [
      new DataDirective(reference, new ImmediatesData(new Array(this.type.concreteType.size).fill(0))).comment(`global ${this.qualifiedIdentifier}`),
      ...compiler.compile(),
    ];
  }

  public toString(){
    if(this.expression){
      return this.withTags(`global ${this.identifier}: ${this.type} = ${this.expression};`);
    }
    return this.withTags(`global ${this.identifier}: ${this.type};`);
  }
}

/**
 * A function declaration. Functions can either be pre-declarations,
 * which do not have a body block, or declarations proper, which do.
 */
class FunctionDeclaration extends Declaration {
  private parameters: TypedIdentifier[];
  private returnType: Type;
  private block?: BlockStatement;

  public constructor(identifier: string, parameters: TypedIdentifier[], returnType: Type, tags: string[], block?: BlockStatement){
    super(identifier);
    this.parameters = parameters;
    this.returnType = returnType;
    this.block = block;

    this.tag(tags);
  }

  private get type(): FunctionType {
    return new FunctionType(this.parameters.map((param) => param.type), this.returnType).tag(this.tags).tag(['.notnull']);
  }

  public kindcheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker());
  }

  public preTypecheck(context: TypeChecker): void {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.symbolTable.set(this.qualifiedIdentifier, new TypedStorage(this.type, 'function'));
  }

  public typecheck(context: TypeChecker): void {
    const isVoid = this.returnType.isConvertibleTo(Type.Void, context);

    // Function pre-declaration (with no block) doesn't need a type-check.
    if(this.block){
      const nestedContext = context.extend(undefined, context.symbolTable.extend());
      this.parameters.forEach((parameter) => {
        nestedContext.symbolTable.set(parameter.identifier, new TypedStorage(parameter.type, 'parameter'));
      });
      nestedContext.symbolTable.set('return', new TypedStorage(this.returnType, 'local'));

      this.block.typecheck(nestedContext);

      // All paths through a function must return.
      if(!isVoid && !this.block.returns()){
        this.error(context, `non-void function missing return`);
      }
    }

    // Check for interrupt handler correctness.
    if(this.interrupt){
      if(this.type.arity > 0){
        this.error(context, `interrupt expected no arguments, actual ${this.type}`);
      }
      if(!isVoid){
        this.error(context, `interrupt expected void return type, actual ${this.returnType}`);
      }
    }

    // For now we can't return non-integral types, like old C.
    if(!isVoid && !this.returnType.isIntegral(context)){
      this.error(context, `expected integral return type, actual ${this.returnType}`);
    }
  }

  public compile(): Directive[] {
    if(this.qualifiedIdentifier === undefined){
      throw new InternalError(`${this} has not been pre-typechecked`);
    }

    if(this.block){
      const compilerClass = this.interrupt ? InterruptCompiler : FunctionCompiler;
      const compiler = new compilerClass(this.qualifiedIdentifier, this.parameters.map((parameter) => {
        return {
          identifier: parameter.identifier,
          size: parameter.type.concreteType.size,
        };
      }));

      this.block.compile(compiler);
      return compiler.compile();
    }

    return [];
  }

  private get interrupt(): boolean {
    return this.tagged('.interrupt');
  }

  public toString(){
    const args = this.parameters.join(', ');
    return this.withTags(`function ${this.identifier}(${args}): ${this.returnType} ${this.block}`);
  }
}

/**
 * A namespace declaration. Namespaces have nested declarations of all kinds within.
 * Multiple declarations of the same namespace are allowed.
 */
class NamespaceDeclaration extends Declaration {
  public readonly declarations: Declaration[];

  public constructor(identifier: string, declarations: Declaration[]){
    super(identifier);
    this.declarations = declarations;
  }

  public get allDeclarations(): Declaration[] {
    const declarations: Declaration[] = [];
    this.declarations.forEach((declaration) => {
      declarations.push(...declaration.allDeclarations);
    });
    return declarations;
  }

  public preKindcheck(context: TypeChecker) {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context = context.extend(undefined, undefined, this.qualifiedIdentifier);
    this.declarations.forEach((declaration) => {
      declaration.preKindcheck(context);
    });
  }

  public kindcheck(context: TypeChecker) {
    context = context.extend(undefined, undefined, this.qualifiedIdentifier);
    this.declarations.forEach((declaration) => {
      declaration.kindcheck(context);
    });
  }

  public preTypecheck(context: TypeChecker) {
    context = context.extend(undefined, undefined, this.qualifiedIdentifier);
    this.declarations.forEach((declaration) => {
      declaration.preTypecheck(context);
    });
  }

  public typecheck(context: TypeChecker) {
    context = context.extend(undefined, undefined, this.qualifiedIdentifier);
    this.declarations.forEach((declaration) => {
      declaration.typecheck(context);
    });
  }

  public compile(): Directive[] {
    throw new InternalError(`namespace ${this.qualifiedIdentifier} cannot be compiled`);
  }

  public toString(){
    return `namespace ${this.identifier} {` +
      indent('\n' + this.declarations.join('\n')) +
      '\n}';
  }

  /**
   * The fully qualified identifier for this namespace's entrypoint.
   */
  public get entrypoint(){
    return `${this.qualifiedIdentifier}::main`;
  }

  /**
   * Concatenates the given namespaces into a single namespace. The new namespace
   * should have the same identifier as the given namespaces.
   *
   * @param identifier the identifier of the new namespace.
   * @param namespaces the namespaces to concatenate.
   */
  public static concat(identifier: string, namespaces: NamespaceDeclaration[]): NamespaceDeclaration {
    const namespace = new NamespaceDeclaration(identifier, []);
    namespaces.forEach((n) => {
      if(namespace.identifier !== n.identifier){
        throw new InternalError(`unable to concatenate mismatched namespaces; expected ${namespace.identifier}, actual ${n.identifier}`);
      }
      namespace.declarations.push(...n.declarations);
    });
    return namespace;
  }
}

class LowLevelProgram {
  public static DEFAULT_NAMESPACE = 'global';

  private typechecked: boolean = false;

  public readonly globalNamespace: NamespaceDeclaration;

  public constructor(namespace: NamespaceDeclaration){
    this.globalNamespace = namespace;
  }

  /**
   * Typecheck this program and return warning and error messages,
   * if any.
   */
  public typecheck(): Messages {
    const context = new TypeChecker();
    this.globalNamespace.preKindcheck(context);
    this.globalNamespace.kindcheck(context);
    this.globalNamespace.preTypecheck(context);
    this.globalNamespace.typecheck(context);
    this.typechecked = true;
    return context;
  }

  /**
   * Compile this program to an assembly program. A program *cannot* be compiled
   * until it has been typechecked.
   *
   * @param module the name of the module we're emitting.
   * @param entrypoint whether to emit a whole-program entry point that calls
   * the main function; libraries are compiled without such an entrypoint, while
   * "proper" programs receive one.
   */
  public compile(module: string = 'out', entrypoint: boolean = true): AssemblyProgram {
    if(!this.typechecked){
      throw new Error(`program has not been typechecked`);
    }

    const declarations = this.declarations;
    const globalDeclarations: GlobalDeclaration[] = declarations.filter((d): d is GlobalDeclaration => d instanceof GlobalDeclaration);
    const functionDeclarations: FunctionDeclaration[] = declarations.filter((d): d is FunctionDeclaration => d instanceof FunctionDeclaration);

    const directives: Directive[] = [];

    // Set up special registers.
    if(entrypoint){
      directives.push(...[
        // TODO: later we should allow the kernel to run a program with any amount of stack.
        new ConstantDirective(Compiler.SP, new ImmediateConstant(VM.DEFAULT_MEMORY_SIZE - 1)).comment('configure sp'),
        new ConstantDirective(Compiler.ONE, new ImmediateConstant(0x1)).comment('configure one'),
      ]);
    }

    const compiler = new Compiler(module);

    directives.push(new LabelDirective(compiler.generateReference('data')));

    globalDeclarations.forEach((declaration) => {
      directives.push(...declaration.compile());
    });

    directives.push(new LabelDirective(compiler.generateReference('program')));
    if(entrypoint){
      directives.push(...this.entrypoint(compiler));
    }

    functionDeclarations.forEach((declaration) => {
      directives.push(...declaration.compile());
    });

    return new AssemblyProgram(directives);
  }

  /**
   * Emits the "whole program" entrypoint, which calls `global::main` and then
   * halts the machine. In the future, we'll emit a call to `lib::exit()`.
   *
   * @param compiler the compiler to use to emit code.
   */
  private entrypoint(compiler: Compiler): Directive[] {
    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(new Reference(`${this.globalNamespace.entrypoint}`))),
    ]);
    const ret = compiler.emitCall([], r);
    compiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.MOV, Compiler.RET, ret)),
      new InstructionDirective(Instruction.createOperation(Operation.HALT)),
    ]);

    return compiler.compile();
  }

  public toString(){
    // Don't include the outer `namespace global ...`.
    return this.globalNamespace.declarations.join('\n');
  }

  /**
   * Returns all of the declarations in the program.
   */
  public get declarations(){
    return this.globalNamespace.allDeclarations;
  }

  /**
   * Concatenate a list of programs into a single program.  That way we can parse several
   * files separately, but typecheck and compile them as one (so we that don't have to
   * figure out "nice" separate compilation for now).
   *
   * @param programs the programs to concatenate.
   * @param namespace the top-level namespace to use; assumes that *all* programs
   * were compiled under the same top-level namespce.
   */
  public static concat(programs: LowLevelProgram[], namespace: string = LowLevelProgram.DEFAULT_NAMESPACE): LowLevelProgram {
    const declaration = NamespaceDeclaration.concat(namespace, programs.map((program) => {
      return program.globalNamespace;
    }));
    return new LowLevelProgram(declaration);
  }

  /**
   * Parses the given program text into a low-level program.
   *
   * @param programText the program text to parse.
   * @param filename the filename of the source of the program text.
   * @param namespace the global namespace for top-level directives.
   */
  public static parse(programText: string, filename?: string, namespace: string = LowLevelProgram.DEFAULT_NAMESPACE): LowLevelProgram {
    // HACK: I couldn't figure out how to allow a file that is *just* a comment, no trailing
    // newline, since you can't match on EOL it seems.
    return parseFile(parse, programText + '\n', filename, { namespace });
  }
}

export {
  Declaration,
  TypeDeclaration, GlobalDeclaration, FunctionDeclaration, NamespaceDeclaration,

  LowLevelProgram,
};
