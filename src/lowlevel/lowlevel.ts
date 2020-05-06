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
import { Expression, StringLiteralExpression } from './expressions';
import { BlockStatement } from './statements';
import { TypeChecker, KindChecker } from './typechecker';
import { mixin, HasTags, HasLocation, Location } from '../lib/util';
import { Compiler, FunctionCompiler, InterruptCompiler, GlobalCompiler } from './compiler';
import { parse } from './parser';
import { TypeTable } from './tables';

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

    // Check this type definition.
    this.type.kindcheck(context, new KindChecker(this.qualifiedIdentifier));
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
 * Represents an instantiation of a template function.
 */
type Instantiation = {
  identity: string;
  type: FunctionType;
};

/**
 * A function declaration. Functions can either be pre-declarations,
 * which do not have a body block, or declarations proper, which do.
 *
 * Function declarations can declare functions or function templates.
 */
class FunctionDeclaration extends Declaration {
  private instantiations: Instantiation[] = [];
  private type: FunctionType;
  private context?: TypeChecker;

  public constructor(
      identifier: string,
      private typeVariables: string[],
      private parameters: TypedIdentifier[],
      private returnType: Type,
      tags: string[],
      private block?: BlockStatement
  ){
    super(identifier);
    const parameterTypes = this.parameters.map((param) => param.type);
    this.type = new FunctionType(
      this.typeVariables,
      parameterTypes,
      this.returnType,
      this.typeVariables.length ? [this.instantiator.bind(this)] : undefined,
    );

    this.tag(tags).tag(['.notnull']);
  }

  public tag(tags?: string[]){
    super.tag(tags);
    this.type.tag(tags);
    return this;
  }

  public at(...args: any[]): this {
    super.at(...args);
    this.type.at(...args);
    return this;
  }

  public kindcheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker());
  }

  public preTypecheck(context: TypeChecker): void {
    this.context = context;
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.symbolTable.set(this.qualifiedIdentifier, new TypedStorage(this.type, 'function'));
  }

  public typecheck(context: TypeChecker): void {
    // We can't typecheck function declarations that are templated;
    // instead they are typechecked when they are instantiated.
    if(this.typeVariables.length){
      if(!this.block){
        this.error(context, `template functions cannot be pre-declared`);
      }
      return;
    }

    // Otherwise, we already have a fully instantiated type, and
    // can check it immediately.
    if(this.block){
      this.instantiator(this.type, new TypeTable());
    }
  }

  private instantiator(type: FunctionType, bindings: TypeTable, source?: Location): void {
    // We check the instantiation in the context in which the function was *defined*,
    // not the one in which it was instantiated.
    if(!this.context){
      throw new InternalError(`no context`);
    }
    let context = this.context;
    if(source){
      const message = `\n\tinstantiated ${this.type}: ${type}`;
      context = context.fromSource(message, source);
    }

    // We never instantiate pre-declarations.
    if(!this.block){
      throw new InternalError(`instantiating pre-declaration ${this}`);
    }

    // Save the instantiation; if we have already checked this instantiation,
    // we're done.
    const identity = type.toIdentity();
    const instantiation = this.instantiations.find((instantiation) => {
      return identity === instantiation.identity;
    });
    if(instantiation){
      return;
    }
    this.instantiations.push({
      identity,
      type,
    });

    // Substituted context.
    const substitutedContext = context.substitute(bindings);

    // Kindcheck.
    type.kindcheck(substitutedContext, new KindChecker());

    // Check argument and return types.
    const returnType = type.apply();
    const nestedContext = substitutedContext.extend(undefined, context.symbolTable.extend());
    this.parameters.forEach((parameter, i) => {
      const argumentType = type.argumentTypes[i];
      nestedContext.symbolTable.set(parameter.identifier, new TypedStorage(argumentType, 'parameter'));
    });
    nestedContext.symbolTable.set('return', new TypedStorage(returnType, 'local'));

    // Check function body.
    this.block.typecheck(nestedContext);

    // All paths through a function must return.
    const isVoid = returnType.isConvertibleTo(Type.Void, substitutedContext);
    if(!isVoid && !this.block.returns()){
      this.error(substitutedContext, `non-void function missing return`);
    }

    // Check for interrupt handler correctness.
    if(this.interrupt){
      if(type.arity > 0){
        this.error(substitutedContext, `interrupt expected no arguments, actual ${type}`);
      }
      if(!isVoid){
        this.error(substitutedContext, `interrupt expected void return type, actual ${returnType}`);
      }
    }

    // For now we can't return non-integral types, like old C.
    if(!isVoid && !returnType.isIntegral(substitutedContext)){
      this.error(substitutedContext, `expected integral return type, actual ${returnType}`);
    }
  }

  public compile(): Directive[] {
    if(this.qualifiedIdentifier === undefined){
      throw new InternalError(`${this} has not been pre-typechecked`);
    }

    // No directives for pre-declarations.
    if(!this.block){
      return [];
    }

    // Compile each instantiation we've called. For non-template
    // types we will only have a single instantiation.
    const directives: Directive[] = [];
    this.instantiations.forEach((instantiation, i) => {
      // Since we compile multiple instantiations for the same qualified
      // identifier, we make the prefix unique by appending the
      // instantiation index.
      const prefix = `${this.qualifiedIdentifier!}_${i}$`;

      // We can't directly use the parameters because they may be
      // templated, and we need the *instantiated* parameters.
      const functionType = instantiation.type;
      const parameters = this.parameters.map((parameter, i) => {
        return {
          identifier: parameter.identifier,
          size: functionType.argumentTypes[i].concreteType.size,
        };
      });
      const compilerClass = this.interrupt ? InterruptCompiler : FunctionCompiler;
      const compiler = new compilerClass(prefix, parameters, instantiation.identity);

      // Compile the body.
      this.block!.compile(compiler);

      // Don't mangle non-template functions.
      const reference = this.typeVariables.length ?
        new Reference(instantiation.qualifiedIdentifier) :
        new Reference(this.qualifiedIdentifier!);

      directives.push(...compiler.compile(reference));
    });

    return directives;
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

    // Construct type and symbol tables and typecheck all declarations.
    this.globalNamespace.preKindcheck(context);
    this.globalNamespace.kindcheck(context);
    this.globalNamespace.preTypecheck(context);
    this.globalNamespace.typecheck(context);

    // Some checks we can't perform until we are sure that we've
    // checked the entire program.
    context.check();

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
