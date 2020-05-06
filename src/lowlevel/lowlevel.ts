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
import { TypeChecker, KindChecker, Source } from './typechecker';
import { mixin, HasTags, HasLocation } from '../lib/util';
import { Compiler, FunctionCompiler, InterruptCompiler, GlobalCompiler } from './compiler';
import { parse } from './parser';
import { TypeTable } from './tables';

const log = logger('lowlevel');

class Liveness {
  public readonly live: { [ref: string]: boolean } = {};
  public readonly links: { [ref: string]: string[] } = {};

  public propagate(): void {
    // Iterate to a fixed point.
    const references = Object.keys(this.links);
    let changes = true;
    while(changes){
      changes = false;
      references.forEach((ref) => {
        if(this.live[ref]){
          this.links[ref].forEach((linkedRef) => {
            if(!this.live[linkedRef]){
              changes = true;
            }
            this.live[linkedRef] = true;
          });
        }
      });
    }
  }

  public toString(){
    const references = Object.keys(this.links);
    references.sort();
    const tables = references.map((ref) => {
      const table = this.links[ref].length ? `\n\t${this.links[ref].join('\n\t')}` : '';
      return `${ref}: ${this.live[ref] || false}${table}`;
    });
    return tables.join('\n');
  }
}

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
  private references: string[] = [];

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
      const expressionContext = context.recordReferences();
      const type = this.expression.typecheck(expressionContext, this.type);
      if(!this.type.isConvertibleTo(type, context)){
        this.error(context, `expected ${this.type}, actual ${type}`)
      }
      this.references = expressionContext.references;
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

  public initializeLiveness(liveness: Liveness): void {
    if(!this.expression){
      return;
    }

    // Globals are always initialized, so function calls in globals
    // are always live.
    this.references.forEach((ref) => {
      liveness.live[ref] = true;
    });
  }
}

/**
 * Represents an instantiation of a template function.
 */
type Instantiation = {
  identity: string;
  qualifiedIdentifier: string;
  type: FunctionType;
  references: string[];
  live: boolean;
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
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.symbolTable.set(this.qualifiedIdentifier, new TypedStorage(this.type, 'function'));

    this.context = context;
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
      this.instantiator(this.type);
    }
  }

  private instantiator(type: FunctionType, bindings?: TypeTable, source?: Source): void {
    // We check the instantiation in the context in which the function was *defined*,
    // not the one in which it was instantiated.
    if(!this.context){
      throw new InternalError(`no context`);
    }
    if(!this.qualifiedIdentifier){
      throw new InternalError(`not yet pre-typechecked`);
    }

    // Record references found in this function instantiation.
    let context = this.context.recordReferences();

    // Track instantiations.
    if(source){
      context = context.fromSource(source);
    }

    // Don't go too deep!
    if(context.instantiationDepth > TypeChecker.MAX_INSTANTIATION_DEPTH){
      this.error(context, `too many instantiations`);
      return;
    }

    // We never instantiate pre-declarations.
    if(!this.block){
      throw new InternalError(`instantiating pre-declaration ${this}`);
    }

    // If we have already checked this instantiation, we're done.
    const identity = bindings ? type.toIdentity() : '';
    const qualifiedIdentifier = bindings ? `${this.qualifiedIdentifier}<${identity}>` : this.qualifiedIdentifier;
    let instantiation = this.instantiations.find((instantiation) => {
      return identity === instantiation.identity;
    });
    if(instantiation){
      return;
    }

    // Save the instantiation immediately so that recursive references to this
    // instantiation are deemed valid and don't recurse.
    instantiation = {
      identity,
      qualifiedIdentifier,
      type,
      references: [],
      live: true, // We assume that the instantiation is live for now, in case we don't run the liveness analysis.
    };
    this.instantiations.push(instantiation);

    // Substituted context binding generic variables, if any.
    const substitutedContext = bindings ? context.substitute(bindings) : context;

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

    // Update this instantiation with recorded references.
    instantiation.references = context.references;
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
      // Don't emit non-live functions.
      if(!instantiation.live){
        return;
      }

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

  public initializeLiveness(liveness: Liveness, entrypoint?: string): void {
    if(!this.block){
      return;
    }
    this.instantiations.forEach((instantiation) => {
      instantiation.live = false;

      if(entrypoint && instantiation.qualifiedIdentifier === entrypoint){
        liveness.live[instantiation.qualifiedIdentifier] = true;
      }
      if(instantiation.type.tagged('.export')){
        liveness.live[instantiation.qualifiedIdentifier] = true;
      }
      liveness.links[instantiation.qualifiedIdentifier] = instantiation.references;
    });
  }

  public updateLiveness(liveness: Liveness): void {
    this.instantiations.forEach((instantiation) => {
      instantiation.live = liveness.live[instantiation.qualifiedIdentifier];
    });
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
    // checked the entire program.  If we already have a bunch of errors,
    // leave these off because they may well have been caused by
    // the previous errors.
    if(!context.errors.length){
      context.check();
    }

    this.typechecked = true;
    return context;
  }

  private livenessAnalysis(globalDeclarations: GlobalDeclaration[], functionDeclarations: FunctionDeclaration[], entrypoint: boolean): void {
    const liveness = new Liveness();

    const entrypointIdentifier = entrypoint ?
      this.globalNamespace.entrypoint :
      undefined;

    globalDeclarations.forEach((dec) => dec.initializeLiveness(liveness));
    functionDeclarations.forEach((dec) => {
      dec.initializeLiveness(liveness, entrypointIdentifier);
    });

    liveness.propagate();

    functionDeclarations.forEach((dec) => {
      dec.updateLiveness(liveness);
    });

    log(`liveness analysis:\n${liveness}`);
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
      throw new InternalError(`program has not been typechecked`);
    }

    const declarations = this.declarations;
    const globalDeclarations: GlobalDeclaration[] = declarations.filter((d): d is GlobalDeclaration => d instanceof GlobalDeclaration);
    const functionDeclarations: FunctionDeclaration[] = declarations.filter((d): d is FunctionDeclaration => d instanceof FunctionDeclaration);

    // Collect liveness information.
    this.livenessAnalysis(globalDeclarations, functionDeclarations, entrypoint);

    const directives: Directive[] = [];

    const compiler = new Compiler(module);

    directives.push(new LabelDirective(compiler.generateReference('program')));
    if(entrypoint){
      directives.push(...this.entrypoint(compiler));
    }
    functionDeclarations.forEach((declaration) => {
      directives.push(...declaration.compile());
    });

    directives.push(new LabelDirective(compiler.generateReference('data')));
    globalDeclarations.forEach((declaration) => {
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
      new ConstantDirective(Compiler.SP, new ImmediateConstant(VM.DEFAULT_MEMORY_SIZE - 1)).comment('configure sp'),
      new ConstantDirective(Compiler.ONE, new ImmediateConstant(0x1)).comment('configure one'),
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
