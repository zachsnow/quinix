import { InternalError, logger, Messages, indent, parseFile, writeOnce, duplicates } from '../lib/util';
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
import { Type, TypedIdentifier, TypedStorage, FunctionType, TemplateType, IdentifierType } from './types';
import { Expression, StringLiteralExpression } from './expressions';
import { BlockStatement } from './statements';
import { TypeChecker, KindChecker, Source } from './typechecker';
import { Syntax } from '../lib/util';
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
abstract class Declaration extends Syntax {
  protected qualifiedIdentifier!: string;

  protected constructor(
    protected readonly identifier: string,
  ){
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
writeOnce(Declaration, 'qualifiedIdentifier');

/**
 * A type declaration. For now type declarations cannot
 * be "abstract".
 */
class TypeDeclaration extends Declaration {
  public constructor(
    identifier: string,
    private readonly type: Type,
  ){
    super(identifier);
  }

  public preKindcheck(context: TypeChecker): void {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.typeTable.set(this.qualifiedIdentifier, this.type);
  }

  public kindcheck(context: TypeChecker): void {
    this.type.elaborate(context);
  }

  public preTypecheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker());
  }

  public toString(){
    return `type ${this.identifier} = ${this.type};`;
  }
}

class TemplateTypeDeclaration extends Declaration {
  private context!: TypeChecker;

  public constructor(
    identifier: string,
    private readonly typeVariables: readonly string[],
    private readonly type: Type,
  ){
    super(identifier);
  }

  private get templateType(): TemplateType {
    return new TemplateType(
      this.typeVariables,
      this.type,
      [this.instantiator.bind(this)],
    ).at(this.location).tag(this.tags);
  }

  public preKindcheck(context: TypeChecker): void {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.typeTable.set(this.qualifiedIdentifier, this.templateType);
  }

  public kindcheck(context: TypeChecker): void {
    this.templateType.elaborate(context);

    // We can't kindcheck a tetmplate type, we can only check its instantiations.
    this.context = context;
  }

  private instantiator(type: Type, typeTable: TypeTable, source: Source): void {
    const context = this.context.fromSource(source);

    // Don't go too deep!
    if(context.instantiationDepth > TypeChecker.MAX_INSTANTIATION_DEPTH){
      this.error(context, `too many instantiations`);
      return;
    }

    // Kindcheck in this context.
    type.kindcheck(context, new KindChecker(this.qualifiedIdentifier));
  }

  public toString(){
    return `type <${this.typeVariables.join(', ')}>${this.identifier} = ${this.type};`;
  }
}
writeOnce(TemplateTypeDeclaration, 'context');

/**
 * A global value declaration. Globals can either be pre-declarations,
 * which do not have an initializing expression, or declarations proper,
 * which do.
 */
class GlobalDeclaration extends Declaration {
  private references: string[] = [];

  public constructor(
    identifier: string,
    private readonly type: Type,
    private readonly expression?: Expression,
  ){
    super(identifier);
  }

  public kindcheck(context: TypeChecker){
    this.type.elaborate(context);
  }

  public preTypecheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker());

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
      if(!type.isConvertibleTo(this.type)){
        this.error(context, `expected ${this.type}, actual ${type}`)
      }
      this.references = expressionContext.references;
    }
  }

  public compile(): Directive[] {
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
    ]);
    if(this.type.integral){
      compiler.emitStaticStore(dr, sr, 1, `store to global ${this.qualifiedIdentifier}`);
    }
    else {
      compiler.emitStaticCopy(dr, sr, this.type.size, `store to global ${this.qualifiedIdentifier}`);
    }

    return [
      new DataDirective(reference, new ImmediatesData(new Array(this.type.size).fill(0))).comment(`global ${this.qualifiedIdentifier}`),
      ...compiler.compile(),
    ];
  }

  public toString(){
    if(this.expression){
      return `global ${this.identifier}: ${this.type} = ${this.expression};`;
    }
    return `global ${this.identifier}: ${this.type};`;
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
 * A function declaration. Functions can either be pre-declarations,
 * which do not have a body block, or declarations proper, which do.
 */
class FunctionDeclaration extends Declaration {
  private references!: string[];
  private live: boolean = false;

  public constructor(
      identifier: string,
      protected readonly parameters: readonly TypedIdentifier[],
      protected readonly returnType: Type,
      protected readonly block?: BlockStatement,
  ){
    super(identifier);
  }

  private get type(): FunctionType {
    return new FunctionType(
      this.parameters.map((parameters) => {
        return parameters.type;
      }),
      this.returnType,
    );
  }

  public qualified(qualifiedIdentifier: string){
    this.qualifiedIdentifier = qualifiedIdentifier;
  }

  public kindcheck(context: TypeChecker): void {
    this.type.elaborate(context);
  }

  public preTypecheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker());

    const duplicateParameters = duplicates(this.parameters.map((parameter) => {
      return parameter.identifier;
    }));
    if(duplicateParameters.length){
      this.error(context, `duplicate parameters ${duplicateParameters.join(', ')}`);
    }

    this.type.argumentTypes.forEach((argumentType) => {
      if(argumentType.isConvertibleTo(Type.Void)){
        this.error(context, `expected non-void argument, actual ${argumentType}`);
      }
    });

    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.symbolTable.set(this.qualifiedIdentifier, new TypedStorage(this.type, 'function'));
  }

  public typecheck(context: TypeChecker): void {
    // Pre-declaration.
    if(!this.block){
      return;
    }

    // Add argument and return types.
    const nestedContext = context.recordReferences().extend(undefined, context.symbolTable.extend());
    this.parameters.forEach((parameter) => {
      nestedContext.symbolTable.set(parameter.identifier, new TypedStorage(parameter.type, 'parameter'));
    });
    nestedContext.symbolTable.set('return', new TypedStorage(this.returnType, 'local'));

    // Check function body.
    this.block.typecheck(nestedContext);

    // All paths through a function must return.
    const isVoid = this.returnType.isConvertibleTo(Type.Void);
    if(!isVoid && !this.block.returns()){
      this.error(context, `non-void function missing return`);
    }

    // Check for interrupt handler correctness.
    if(this.interrupt){
      if(this.parameters.length > 0){
        this.error(context, `interrupt expected no arguments, actual ${this.type}`);
      }
      if(!isVoid){
        this.error(context, `interrupt expected ${Type.Void} return type, actual ${this.returnType}`);
      }
    }

    // Update this instantiation with recorded references.
    this.references = nestedContext.references;
  }

  public compile(): Directive[] {
    // No directives for pre-declarations.
    if(!this.block){
      return [];
    }
    if(!this.live){
      return [];
    }

    const directives: Directive[] = [];

    const parameters = this.parameters.map((parameter, i) => {
      return {
        identifier: parameter.identifier,
        size: parameter.type.size,
      };
    });

    // If we return a non-integral, we instead pass a pointer to the place to write the return value.
    if(!this.returnType.integral && !this.returnType.isConvertibleTo(Type.Void)){
      parameters.unshift({
        identifier: '$return',
        size: 1,
      });
    }

    const compilerClass = this.interrupt ? InterruptCompiler : FunctionCompiler;
    const compiler = new compilerClass(this.qualifiedIdentifier, parameters);

    // Compile the body.
    this.block.compile(compiler);

    // Compile the entire function.
    const reference = new Reference(this.qualifiedIdentifier);
    directives.push(...compiler.compile(reference));

    return directives;
  }

  private get interrupt(): boolean {
    return this.tagged('.interrupt');
  }

  public initializeLiveness(liveness: Liveness, entrypoint?: string): void {
    if(!this.block){
      return;
    }

    if(entrypoint && this.qualifiedIdentifier === entrypoint){
      liveness.live[this.qualifiedIdentifier] = true;
    }
    if(this.tagged('.export')){
      liveness.live[this.qualifiedIdentifier] = true;
    }

    liveness.links[this.qualifiedIdentifier] = this.references;
  }

  public updateLiveness(liveness: Liveness){
    this.live = liveness.live[this.qualifiedIdentifier];
  }

  public toString(){
    const args = this.parameters.join(', ');
    return `function ${this.identifier}(${args}): ${this.returnType} ${this.block}`;
  }
}
writeOnce(FunctionDeclaration, 'references');

/**
 * Represents an instantiation of a template function into a "normal"
 * function declaration.
 */
type Instantiation = {
  qualifiedIdentifier: string;
  declaration: FunctionDeclaration;
};

/**
 * A template function declaration.
 */
class TemplateFunctionDeclaration extends Declaration {
  private readonly instantiations: Instantiation[] = [];
  private context!: TypeChecker;

  public constructor(
    identifier: string,
    private readonly typeVariables: readonly string[],
    private readonly parameters: readonly TypedIdentifier[],
    private readonly returnType: Type,
    private readonly block: BlockStatement,
  ){
    super(identifier);

    if(!this.typeVariables.length){
      throw new InternalError(`expected type variables`);
    }
  }

  private get functionType(): FunctionType {
    return new FunctionType(
      this.parameters.map((parameter) => {
        return parameter.type;
      }),
      this.returnType,
    ).at(this.location).tag(this.tags);
  }

  private get type(): Type {
    return new TemplateType(
      this.typeVariables,
      this.functionType,
      [this.instantiator.bind(this)],
    ).at(this.location).tag(this.tags);
  }

  public get functionDeclarations(): FunctionDeclaration[] {
    return this.instantiations.map((instantiation) => {
      return instantiation.declaration;
    });
  }

  public kindcheck(context: TypeChecker){
    const duplicateParameters = duplicates(this.parameters.map((parameter) => {
      return parameter.identifier;
    }));
    if(duplicateParameters.length){
      this.error(context, `duplicate parameters ${duplicateParameters.join(', ')}`);
    }

    const nestedContext = context.extend(
      context.typeTable.extend(),
      undefined,
    );
    this.typeVariables.forEach((tv) => {
      nestedContext.typeTable.set(tv, new IdentifierType(tv));
    });
    this.functionType.elaborate(nestedContext);

    // Since we want to check the instantiation in the context in which
    // the template was defined, we save it for later use.
    this.context = context;
  }

  public preTypecheck(context: TypeChecker): void {
    this.qualifiedIdentifier = context.prefix(this.identifier);
    context.symbolTable.set(this.qualifiedIdentifier, new TypedStorage(this.type, 'function'));
  }

  public typecheck(context: TypeChecker){
    // We can't typecheck function declarations that are templated;
    // instead they are typechecked when they are instantiated.
  }

  private instantiator(type: Type, typeTable: TypeTable, source: Source): void {
    if(!this.block){
      throw new InternalError(`unexpected template pre-declaration`);
    }

    if(!(type instanceof FunctionType)){
      this.error(this.context, `expected function type, actual ${type}`);
      return;
    }

    // Use the context in which the function was *defined*, not the one in
    // which it is being instantiated.
    //
    // Record references found in this function instantiation.
    const context = this.context.fromSource(source).recordReferences();

    // TODO: should we do this instantiate()?
    type.kindcheck(context, new KindChecker());
    type.argumentTypes.forEach((argumentType) => {
      if(argumentType.isConvertibleTo(Type.Void)){
        this.error(context, `expected non-void argument, actual ${argumentType}`);
      }
    });

    // Don't go too deep!
    if(context.instantiationDepth > TypeChecker.MAX_INSTANTIATION_DEPTH){
      this.error(context, `too many instantiations`);
      return;
    }

    // If we have already checked this instantiation, we're done.
    const qualifiedIdentifier = `${this.qualifiedIdentifier}<${type}>`;
    const instantiation = this.instantiations.find((instantiation) => {
      return qualifiedIdentifier === instantiation.qualifiedIdentifier;
    });
    if(instantiation){
      return;
    }

    // Create and save the instantiation immediately so that recursive references to this
    // instantiation are deemed valid and don't recurse.  We instantiate a new copy
    // of the function body so that each instantiation can have different concrete
    // types for expressions.
    const functionDeclaration = new FunctionDeclaration(
      this.identifier,
      this.parameters.map((parameter, i) => {
        return new TypedIdentifier(
          parameter.identifier,
          type.argumentTypes[i],
        );
      }),
      type.returnType,
      this.block.substitute(typeTable),
    );

    // The function declaration already has a qualified identifier,
    // which includes the type.
    functionDeclaration.qualified(qualifiedIdentifier);

    this.instantiations.push({
      qualifiedIdentifier,
      declaration: functionDeclaration,
    });

    // Check the function declaration.
    functionDeclaration.typecheck(context);
  }

  public compile(): Directive[] {
    const directives: Directive[] = [];
    this.instantiations.forEach((instantiation) => {
      directives.push(...instantiation.declaration.compile());
    });
    return directives;
  }

  public initializeLiveness(liveness: Liveness, entrypoint?: string): void {
    this.instantiations.forEach((instantiation) => {
      instantiation.declaration.initializeLiveness(liveness, entrypoint);
    });
  }

  public toString(){
    const args = this.parameters.join(', ');
    return `function ${this.identifier}<${this.typeVariables.join(', ')}>(${args}): ${this.returnType} ${this.block}`;
  }
}
writeOnce(FunctionDeclaration, 'context');

class UsingDeclaration extends Declaration {
  public constructor(identifier: string){
    super(identifier);
  }

  public preKindcheck(context: TypeChecker) {
    // TODO: qualify this for reals.
    this.qualifiedIdentifier = this.identifier;
    context.using([this.qualifiedIdentifier]);
  }

  public toString(){
    return `using ${this.qualifiedIdentifier};`
  }
}
/**
 * A namespace declaration. Namespaces have nested declarations of all kinds within.
 * Multiple declarations of the same namespace are allowed.
 */
class NamespaceDeclaration extends Declaration {
  private usings: string[] = [];

  public constructor(
    identifier: string,
    public readonly declarations: readonly Declaration[],
  ){
    super(identifier);
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
    this.usings = [...context.usings];
  }

  public kindcheck(context: TypeChecker) {
    context = context.extend(undefined, undefined, this.qualifiedIdentifier);
    context.using(this.usings);
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
    context.using(this.usings);
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
    const declarations: Declaration[] = [];
    namespaces.forEach((namespace) => {
      if(identifier !== namespace.identifier){
        throw new InternalError(`unable to concatenate mismatched namespaces; expected ${identifier}, actual ${namespace.identifier}`);
      }
      declarations.push(...namespace.declarations);
    });
    return new NamespaceDeclaration(identifier, declarations);
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

    log(`liveness analysis:\n${liveness}`);

    functionDeclarations.forEach((dec) => {
      dec.updateLiveness(liveness);
    });
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
    declarations.forEach((d) => {
      if(d instanceof TemplateFunctionDeclaration){
        functionDeclarations.push(...d.functionDeclarations);
      }
    });

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
  TemplateTypeDeclaration, TypeDeclaration, GlobalDeclaration, FunctionDeclaration,
  UsingDeclaration, NamespaceDeclaration,
  TemplateFunctionDeclaration,

  LowLevelProgram,
};
