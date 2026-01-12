import {
  InternalError, Messages, indent, parseFile, writeOnce, duplicates, flatten,
  IFileRange, IParseOptions,
} from '../lib/util';
import { logger } from '../lib/logger';
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
import { Type, TypedIdentifier, TypedStorage, FunctionType, TemplateType, Storage, ArrayType, SliceType } from './types';
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
  public readonly links: { [ref: string]: readonly string[] } = {};

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
  /**
   * All declarations live in a namespace. We don't
   * know which namespace when we instantiate the
   * declaration, but when we add declarations to
   * a namespace we update them.
   *
   * The top-level `global` namespace is the only namespace
   * that has no parent.
   */
  public namespace?: NamespaceDeclaration;

  /**
   * Sets the parent namespace of this declaration.
   *
   * @param namespace the namespace in which this declaration appears.
   */
  public inNamespace(namespace: NamespaceDeclaration): void {
    this.namespace = namespace;
  }

  /**
   * Checks type-level declarations to verify
   * that each type is valid.  This ensures that e.g. all
   * identifiers resolve to a type.
   *
   * @param context the type checking context.
   */
  public abstract kindcheck(context: TypeChecker): void;

  /**
   * Checks value-level objects to verity
   * type correctness. This the "real" typechecking pass.
   *
   * @param context the type checking context.
   */
  public abstract typecheck(context: TypeChecker): void;

  /**
   * Returns all of the declarations found within
   * this declaration, including the declaration itself.
   */
  public get allDeclarations(): Declaration[] {
    return [ this ];
  }
}

/**
 * Base class for declarations with an identifier; the only
 * unnmamed declarations are `using` declarations.
 */
abstract class NamedDeclaration extends Declaration {
  public constructor(
    public readonly identifier: string,
  ){
    super();
  }

  /**
   * Returns the fully qualified identifier for this declaration. For instance,
   * if this declaration is a global `foo` in namespace `bar`, the fully qualified
   * identifier is `global::foo::bar`.
   */
  public get qualifiedIdentifier(): string {
    if(this.namespace){
      return `${this.namespace.qualifiedIdentifier}::${this.identifier}`;
    }
    throw new InternalError('no namespace');
  }

  public static isFullyQualified(qualifiedIdentifier: string): boolean {
    return qualifiedIdentifier.split('::')[0] === LowLevelProgram.GLOBAL_NAMESPACE;
  }
}

/**
 * Base class for declarations that introduce a value (e.g. a function, a global).
 */
abstract class BaseValueDeclaration extends NamedDeclaration {
  public abstract get storage(): Storage;
  public abstract get type(): Type;
}

/**
 * Base class for declarations that introduce a type.
 */
abstract class BaseTypeDeclaration extends NamedDeclaration {
  public abstract get type(): Type;
}

/**
 * A type declaration. For now type declarations cannot
 * be "abstract".
 */
class TypeDeclaration extends BaseTypeDeclaration {
  public constructor(
    identifier: string,
    public readonly type: Type,
  ){
    super(identifier);
  }

  public kindcheck(context: TypeChecker): void {
    log.debug(`kindchecking ${this}`);
    this.type.kindcheck(context, new KindChecker(this.qualifiedIdentifier));
  }

  public typecheck(context: TypeChecker): void {}

  public toString(){
    return `type ${this.identifier} = ${this.type};`;
  }
}

class TemplateTypeDeclaration extends BaseTypeDeclaration {
  private context!: TypeChecker;

  public constructor(
    identifier: string,
    private readonly typeVariables: readonly string[],
    private readonly unboundType: Type,
  ){
    super(identifier);
  }

  public get type(): TemplateType {
    return new TemplateType(
      this.typeVariables,
      this.unboundType,
      [this.instantiator.bind(this)],
    ).at(this.location).tag(this.tags);
  }

  public kindcheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker(this.qualifiedIdentifier));
  }

  private instantiator(context: TypeChecker, kindchecker: KindChecker, type: Type, typeTable: TypeTable, source: Source): void {
    if(!this.namespace){
      throw new InternalError('no namespace');
    }

    context = context.forSource(source).forNamespace(this.namespace);

    // Don't go too deep!
    if(context.instantiationDepth > TypeChecker.MAX_INSTANTIATION_DEPTH){
      this.error(context, `too many instantiations`);
      return;
    }

    // Kindcheck in this context (so that name lookups work correct),
    // but with whatever substitution was in place at the instantiation point
    // (so that generic variables can be found).
    type.kindcheck(context, new KindChecker(this.qualifiedIdentifier).withTypeTable(kindchecker.typeTable));
  }

  public typecheck(context: TypeChecker): void {}

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
class GlobalDeclaration extends BaseValueDeclaration {
  private references: string[] = [];

  public constructor(
    identifier: string,
    public readonly type: Type,
    private readonly expression?: Expression,
  ){
    super(identifier);
  }

  public get storage(): Storage {
    return 'global';
  }

  public kindcheck(context: TypeChecker){
    this.type.kindcheck(context, new KindChecker());
  }

  public typecheck(context: TypeChecker){
    // Pre-declarations don't need typechecking; we assume that the module
    // that actually declares them is already typechecked and that the
    // pre-declaration is correct.
    if(!this.expression){
      return;
    }

    const expressionContext = context.recordReferences();
    const type = this.expression.typecheck(expressionContext, this.type);
    if(!type.isConvertibleTo(this.type)){
      this.error(context, `expected ${this.type}, actual ${type}`)
    }

    this.references = expressionContext.references;
  }

  /**
   * Returns the data directives for this global (static storage).
   */
  public compileData(): Directive[] {
    // Global pre-declarations aren't compiled.
    if(!this.expression){
      return [];
    }

    const reference = new Reference(this.qualifiedIdentifier);

    // We can make a nice string in the assembly by special-casing string literals
    // when the global is an array type (not a slice).
    if(this.expression instanceof StringLiteralExpression){
      const cType = this.type.resolve();
      // Only special-case for arrays; slices need the full compilation path.
      if(cType instanceof ArrayType){
        const len = this.expression.length;
        return [
          new DataDirective(reference, new ImmediatesData([len])).comment('length header'),
          new DataDirective(new Reference(`${this.qualifiedIdentifier}_text$`), new TextData(this.expression.text)),
        ];
      }
      // For slices, fall through to normal compilation - reserve space for slice descriptor.
    }

    // We can skip some moves and stores by special-casing constant values.
    const constant = this.expression.constant();
    if(constant !== undefined){
      return [
        new DataDirective(reference, new ImmediatesData([ constant ])),
      ];
    }

    // Reserve space for this global. Initialization happens in compileInit().
    return [
      new DataDirective(reference, new ImmediatesData(new Array(this.type.size).fill(0))).comment(`global ${this.qualifiedIdentifier}`),
    ];
  }

  /**
   * Returns the initialization code for this global (runs at startup).
   */
  public compileInit(): Directive[] {
    // Global pre-declarations don't need initialization.
    if(!this.expression){
      return [];
    }

    // String literals in arrays are handled statically in compileData().
    if(this.expression instanceof StringLiteralExpression){
      const cType = this.type.resolve();
      if(cType instanceof ArrayType){
        return [];
      }
    }

    // Constants are handled statically in compileData().
    const constant = this.expression.constant();
    if(constant !== undefined){
      return [];
    }

    // Otherwise, we need to compile initialization code.
    const reference = new Reference(this.qualifiedIdentifier);
    const compiler = new GlobalCompiler(this.qualifiedIdentifier);
    const sr = this.expression.compile(compiler);
    const dr = compiler.allocateRegister();

    compiler.emit([
      new ConstantDirective(dr, new ReferenceConstant(reference)).comment(`reference global ${this.qualifiedIdentifier}`),
    ]);

    // Handle array-to-slice conversion: create a slice descriptor.
    const cGlobalType = this.type.resolve();
    const cExprType = this.expression.concreteType.resolve();
    if(cGlobalType instanceof SliceType && cExprType instanceof ArrayType){
      // Create slice descriptor: [pointer][length][capacity]
      // sr points to array which is [length][data...]
      // Slice pointer = sr + 1 (skip length header)
      const ptrR = compiler.allocateRegister();
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.ADD, ptrR, sr, Compiler.ONE)).comment('slice pointer = array + 1'),
      ]);
      compiler.emitStaticStore(dr, ptrR, 1, 'slice.pointer');
      compiler.deallocateRegister(ptrR);

      // Load array length and store as slice length and capacity
      const lenR = compiler.allocateRegister();
      compiler.emit([
        new InstructionDirective(Instruction.createOperation(Operation.LOAD, lenR, sr)).comment('load array length'),
      ]);
      compiler.emitIncrement(dr, 1);
      compiler.emitStaticStore(dr, lenR, 1, 'slice.length');
      compiler.emitIncrement(dr, 1);
      compiler.emitStaticStore(dr, lenR, 1, 'slice.capacity');
      compiler.deallocateRegister(lenR);
    }
    else if(this.type.integral){
      compiler.emitStaticStore(dr, sr, 1, `store to global ${this.qualifiedIdentifier}`);
    }
    else {
      compiler.emitStaticCopy(dr, sr, this.type.size, `store to global ${this.qualifiedIdentifier}`);
    }

    return compiler.compile();
  }

  /**
   * Compiles both data and initialization code for backwards compatibility.
   */
  public compile(): Directive[] {
    return [...this.compileData(), ...this.compileInit()];
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
class FunctionDeclaration extends BaseValueDeclaration {
  private references!: readonly string[];
  private parameterIdentities!: readonly string[]
  private live: boolean = false;

  public constructor(
      identifier: string,
      protected readonly parameters: readonly TypedIdentifier[],
      protected readonly returnType: Type,
      protected readonly block?: BlockStatement,
  ){
    super(identifier);
  }

  public get storage(): Storage {
    return 'function';
  }

  public get type(): FunctionType {
    return new FunctionType(
      this.parameters.map((parameters) => {
        return parameters.type;
      }),
      this.returnType,
    );
  }

  public kindcheck(context: TypeChecker): void {
    this.type.kindcheck(context, new KindChecker());

    const duplicateParameters = duplicates(this.parameters.map((parameter) => {
      return parameter.identifier;
    }));
    if(duplicateParameters.length){
      this.error(context, `duplicate parameters ${duplicateParameters.join(', ')}`);
    }
  }

  public typecheck(context: TypeChecker): void {
    // Pre-declaration.
    if(!this.block){
      return;
    }

    // Add argument and return types; record the parameter identities so that
    // we can handle shadowing.
    const nestedContext = context.recordReferences().extend(context.symbolTable.extend());
    this.parameterIdentities = this.parameters.map((parameter) => {
      const identity = nestedContext.symbolTable.set(parameter.identifier, new TypedStorage(parameter.type, 'parameter'));
      return identity;
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
        identifier: this.parameterIdentities[i],
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

  public initializeLiveness(liveness: Liveness): void {
    if(!this.block){
      return;
    }

    // We always mark `main` as live.
    if(this.qualifiedIdentifier === LowLevelProgram.ENTRYPOINT){
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
  identifier: string;
  declaration: FunctionDeclaration;
};

/**
 * A template function declaration.
 */
class TemplateFunctionDeclaration extends BaseValueDeclaration {
  private readonly instantiations: Instantiation[] = [];

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

  public get storage(): Storage {
    return 'function';
  }

  private get unboundType(): FunctionType {
    return new FunctionType(
      this.parameters.map((parameter) => {
        return parameter.type;
      }),
      this.returnType,
    ).at(this.location).tag(this.tags);
  }

  public get type(): Type {
    return new TemplateType(
      this.typeVariables,
      this.unboundType,
      [this.instantiator.bind(this)],
    ).at(this.location).tag(this.tags);
  }

  public get functionDeclarations(): FunctionDeclaration[] {
    return this.instantiations.map((instantiation) => {
      return instantiation.declaration;
    });
  }

  public kindcheck(context: TypeChecker){
    this.type.kindcheck(context, new KindChecker());

    const duplicateParameters = duplicates(this.parameters.map((parameter) => {
      return parameter.identifier;
    }));
    if(duplicateParameters.length){
      this.error(context, `duplicate parameters ${duplicateParameters.join(', ')}`);
    }
  }


  public typecheck(context: TypeChecker){
    // We can't typecheck function declarations that are templated;
    // instead they are typechecked when they are instantiated.
  }

  private instantiator(context: TypeChecker, kindchecker: KindChecker, type: Type, typeTable: TypeTable, source: Source): void {
    if(!this.namespace){
      throw new InternalError('no namespace');
    }
    if(!this.block){
      throw new InternalError(`unexpected template pre-declaration`);
    }

    // Use the context in which the function was *defined*, not the one in
    // which it is being instantiated.
    //
    // Record references found in this function instantiation.
    context = context.forNamespace(this.namespace).forSource(source).recordReferences();

    if(!(type instanceof FunctionType)){
      this.error(context, `expected function type, actual ${type}`);
      return;
    }

    // TODO: should we do this in instantiate()?
    type.kindcheck(context, new KindChecker().withTypeTable(kindchecker.typeTable));
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
    const identifier = `${this.identifier}<${type}>`;
    const instantiation = this.instantiations.find((instantiation) => {
      return identifier === instantiation.identifier;
    });
    if(instantiation){
      return;
    }

    // Create and save the instantiation immediately so that recursive references to this
    // instantiation are deemed valid and don't recurse.  We instantiate a new copy
    // of the function body so that each instantiation can have different concrete
    // types for expressions.
    const functionDeclaration = new FunctionDeclaration(
      identifier,
      this.parameters.map((parameter, i) => {
        return new TypedIdentifier(
          parameter.identifier,
          type.argumentTypes[i],
        );
      }),
      type.returnType,
      this.block.substitute(typeTable),
    );

    // Put this function declaration in our namespace.
    if(this.namespace){
      functionDeclaration.inNamespace(this.namespace);
    }

    this.instantiations.push({
      identifier,
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
      instantiation.declaration.initializeLiveness(liveness);
    });
  }

  public toString(){
    const args = this.parameters.join(', ');
    return `function ${this.identifier}<${this.typeVariables.join(', ')}>(${args}): ${this.returnType} ${this.block}`;
  }
}
writeOnce(FunctionDeclaration, 'context');

class UsingDeclaration extends Declaration {
  public constructor(
    private readonly identifier: string,
  ) {
    super();
  }

  public kindcheck(context: TypeChecker): void {
    if(!this.namespace){
      throw new InternalError('using outside of namespace');
    }

    // Make sure this is a fully qualified identifier.
    if(!NamedDeclaration.isFullyQualified(this.qualifiedIdentifier)){
      this.error(context, `expected fully qualified namespace identifier`);
      return;
    }

    // Make sure that this using refers to a real namespace.
    const namespaces = this.namespace.root.getNamespaces(this.qualifiedIdentifier);
    if(namespaces.length === 0){
      this.error(context, `unknown namespace identifier ${this.identifier}`);
      return;
    }

    // Let's avoid redundant usings; we only check in "our" namespace declaration because
    // that's the only place where our using is in effect.
    this.namespace.usings.forEach((using) => {
      if(using !== this && using.qualifiedIdentifier === this.qualifiedIdentifier){
        this.error(context, `duplicate using declaration ${this.qualifiedIdentifier}`);
      }
    });
  }

  public typecheck(context: TypeChecker){}

  public get qualifiedIdentifier(): string {
    return this.identifier;
  }


  public toString(){
    return `using ${this.identifier};`
  }
}

/**
 * A namespace declaration. Namespaces have nested declarations of all kinds within.
 * Multiple declarations of the same namespace are allowed.
 */
class NamespaceDeclaration extends NamedDeclaration {
  public constructor(
    identifier: string,
    public readonly declarations: readonly Declaration[],
  ){
    super(identifier);

    if(this.identifier.indexOf('::') !== -1){
      throw new InternalError('unexpected qualified identifier');
    }

    // Push
    this.declarations.forEach((dec) => {
      dec.inNamespace(this);
    });
  }

  /**
   * Get the root namespace.
   */
  public get root(): NamespaceDeclaration {
    return this.namespace ? this.namespace.root : this;
  }

  public get qualifiedIdentifier(): string {
    if(this.namespace){
      return `${this.namespace.qualifiedIdentifier}::${this.identifier}`;
    }

    // Global.
    return this.identifier;
  }

  /**
   * Returns the using declarations found in this namespace.
   */
  public get usings(): UsingDeclaration[] {
    return this.declarations.filter((dec): dec is UsingDeclaration => {
      return dec instanceof UsingDeclaration;
    });
  }

  /**
   * Looks up the potentially partially qualified identifier in this
   * namespace and its parents, taking into account usings.
   *
   * @param identifier a partially qualified type identifier to look up.
   */
  public lookupType(context: TypeChecker, identifier: string): TypeDeclaration | TemplateTypeDeclaration | undefined {
    return this.lookup<BaseTypeDeclaration>(context, BaseTypeDeclaration, identifier);
  }

  /**
   * Looks up the potentially partially qualified identifier in this
   * namespace and its parents, taking into account usings.
   *
   * @param identifier a partially qualified value identifier to look up.
   */
  public lookupValue(context: TypeChecker, identifier: string){
    return this.lookup<BaseValueDeclaration>(context, BaseValueDeclaration, identifier);
  }

  /**
   * Gets the given namespace within this namespace, ignoring parent
   * namespaces and usings.  Because we may have multiple declarations of
   * the same namespace, we return a list of declarations.
   *
   * @param qualifiedIdentifier the namespace for which to find all declarations.
   */
  public getNamespaces(qualifiedIdentifier: string) : NamespaceDeclaration[] {
    // If we aren't the root namespace, build the fully qualified identifier
    // for the given qualified identifier and get all namespace declarations that define
    // the namespace from the root.
    //
    // For instance, if we are looking for `foo::bar` in namespace `bleck::baz`,
    // build the fully qualified identifier `bleck::baz::foo::bar` and ask the
    // root namespace to return all matching declarations.
    if(this.namespace){
      return this.root.getNamespaces(`${this.qualifiedIdentifier}::${qualifiedIdentifier}`);
    }
    // Now we have a fully qualified identifier and we are the root namespace.
    if(!NamedDeclaration.isFullyQualified(qualifiedIdentifier)){
      qualifiedIdentifier = `${this.qualifiedIdentifier}::${qualifiedIdentifier}`;
    }
    const parts = qualifiedIdentifier.split('::');

    // Special case: `global` always refers to the outermost namespace
    // (which doesn't have a parent), so we just strip it off.
    if(parts[0] !== LowLevelProgram.GLOBAL_NAMESPACE){
      throw new InternalError(`expected ${qualifiedIdentifier} to be fully qualified`);
    }
    parts.shift();

    // If we are just looking for `global`, we've found it, and there's only 1.
    if(!parts.length){
      return [ this ];
    }

    // Now we recurse through the tree of declarations and collect all namespaces that match.
    function get(namespace: NamespaceDeclaration, path: string[]): NamespaceDeclaration[] {
      const namespaces = namespace.declarations.map((dec) => {
        if(dec instanceof NamespaceDeclaration && dec.identifier === path[0]){
          if(path.length > 1){
            return get(dec, path.slice(1));
          }
          return [ dec ]
        }
        return [];
      });
      return flatten(namespaces);
    }
    return get(this, parts);
  }

  private lookup<T extends NamedDeclaration>(context: TypeChecker, cls: Function, qualifiedIdentifier: string): T | undefined {
    // If we are looking up a fully qualified identifier, jump straight to the root.
    if(NamedDeclaration.isFullyQualified(qualifiedIdentifier)){
      return this.root.get<T>(cls, qualifiedIdentifier);
    }

    // First do a direct lookup in the current namespace. For instance,
    // if `identifier` is `foo::bar`, then look for a namespace named `foo`
    // in `this`, and then an identifier named `bar` in that namespace.
    const object = this.get<T>(cls, qualifiedIdentifier);
    if(object !== undefined){
      return object;
    }

    // Next use our usings. Each using is a fully qualified
    // identifier; we append the identifier we are looking for and perform
    // a direct lookup.
    const objects = this.usings.map((using) => {
      const fullyQualifiedIdentifier = `${using.qualifiedIdentifier}::${qualifiedIdentifier}`;
      return this.root.get<T>(cls, fullyQualifiedIdentifier);
    }).filter((object): object is T => !!object);
    if(objects.length > 1){
      this.error(context, `ambiguous identifier ${qualifiedIdentifier} refers to ${objects.map((object) => object.qualifiedIdentifier).join(', ')}`);
      return;
    }
    else if(objects.length === 1){
      return objects[0];
    }

    // Finally, do a recursive lookup the parent, if we have one.
    if(this.namespace){
      return this.namespace.lookup<T>(context, cls, qualifiedIdentifier);
    }

    // Not found.
    return;
  }

  private get<T extends NamedDeclaration>(cls: Function, qualifiedIdentifier: string): T | undefined {
    // Get all namespaces declarations that define the namespace containing the
    // qualified identifier's final identifier. For instance, if we are in `baz::bleck`
    // and look up `foo::bar`, we get all namespaces defining `baz::bleck::foo`.
    const parts = qualifiedIdentifier.split('::');
    if(NamedDeclaration.isFullyQualified(qualifiedIdentifier)){
      parts.shift();
    }
    const prefix = parts.slice(0, parts.length - 1).join('::');
    const identifier = parts[parts.length - 1];
    const namespaceIdentifier = prefix ? `${this.qualifiedIdentifier}::${prefix}` : this.qualifiedIdentifier;
    const namespaces = this.root.getNamespaces(namespaceIdentifier);

    // Now we look up the final identifier in all of the namespace declarations.
    const objects = namespaces.map((namespace) => {
      return namespace.declarations.find((declaration): declaration is T => {
        if(declaration instanceof cls){
          if((declaration as T).identifier === identifier){
            return true;
          }
        }
        return false;
      });
    }).filter((object): object is T => !!object);

    if(objects.length > 1){
      throw new InternalError(`multiple definitions: ${objects.join(', ')}`);
    }
    else if(objects.length === 1){
      return objects[0];
    }
    else {
      return;
    }
  }

  public get allDeclarations(): Declaration[] {
    const declarations: Declaration[] = [];
    this.declarations.forEach((declaration) => {
      declarations.push(...declaration.allDeclarations);
    });
    return declarations;
  }

  public kindcheck(context: TypeChecker) {
    const nestedContext = context.forNamespace(this);
    this.declarations.forEach((declaration) => {
      declaration.kindcheck(nestedContext);
    });
  }

  public typecheck(context: TypeChecker) {
    const nestedContext = context.forNamespace(this);
    this.declarations.forEach((declaration) => {
      declaration.typecheck(nestedContext);
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
   * Concatenates the given namespaces into a single namespace. The new namespace
   * should have the same identifier as the given namespaces.
   *
   * @param identifier the identifier of the new namespace.
   * @param namespaces the namespaces to concatenate.
   */
  public static concat(identifier: string, namespaces: NamespaceDeclaration[]): NamespaceDeclaration {
    const declarations: Declaration[] = [...NamespaceDeclaration.builtins];
    namespaces.forEach((namespace) => {
      if(identifier !== namespace.identifier){
        throw new InternalError(`unable to concatenate mismatched namespaces; expected ${identifier}, actual ${namespace.identifier}`);
      }
      declarations.push(...namespace.declarations);
    });
    return new NamespaceDeclaration(identifier, declarations);
  }

  /**
   * Creates a new namespace containing the given declarations; for qualified
   * identifiers creates nested namespaces. This effectively converts:
   *
   *  namespace std::io {
   *    // ...
   *  }
   *
   * To:
   *
   *  namespace std {
   *    namespace io {
   *      // ...
   *    }
   *  }
   *
   * @param identifier a possibly qualified identifier.
   * @param declarations the declarations for the namespace.
   */
  public static build(identifier: string, declarations: Declaration[], range: IFileRange, text: string, options?: IParseOptions): NamespaceDeclaration {
    const parts = identifier.split('::');
    const final = parts.pop();
    parts.reverse();

    if(!final){
      throw new InternalError(`invalid identifier ${identifier}`);
    }

    let ns = new NamespaceDeclaration(final, declarations).at(range, text, options);
    parts.forEach((part) => {
      ns = new NamespaceDeclaration(part, [ns]).at(range, text, options);
    });

    return ns;
  }

  public static builtins = [
    new TypeDeclaration('bool', Type.Byte),
    new TypeDeclaration('string', new SliceType(Type.Byte)),
  ];
}

class LowLevelProgram {
  public static GLOBAL_NAMESPACE = 'global';
  public static ENTRYPOINT = 'global::main';

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
    const context = new TypeChecker(this.globalNamespace);

    // Kindcheck and typecheck all definitions.
    try {
      this.globalNamespace.kindcheck(context);
      this.globalNamespace.typecheck(context);
    }
    catch(e){
      if(e instanceof InternalError){
        context.error(e.message);
      }
      else {
        throw e;
      }
    }

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

  private livenessAnalysis(globalDeclarations: GlobalDeclaration[], functionDeclarations: FunctionDeclaration[]): void {
    const liveness = new Liveness();

    globalDeclarations.forEach((dec) => dec.initializeLiveness(liveness));
    functionDeclarations.forEach((dec) => {
      dec.initializeLiveness(liveness);
    });

    liveness.propagate();

    log.debug(`liveness analysis:\n${liveness}`);

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
    this.livenessAnalysis(globalDeclarations, functionDeclarations);

    const directives: Directive[] = [];

    const compiler = new Compiler(module);

    directives.push(new LabelDirective(compiler.generateReference('program')));
    if(entrypoint){
      // Emit entrypoint: setup, global init, call main, halt
      directives.push(...this.entrypoint(compiler, globalDeclarations));
    }
    functionDeclarations.forEach((declaration) => {
      directives.push(...declaration.compile());
    });

    directives.push(new LabelDirective(compiler.generateReference('data')));
    globalDeclarations.forEach((declaration) => {
      directives.push(...declaration.compileData());
    });

    return new AssemblyProgram(directives);
  }

  /**
   * Emits the "whole program" entrypoint, which:
   * 1. Sets up SP and ONE
   * 2. Runs global initialization code
   * 3. Calls `global::main`
   * 4. Halts the machine
   *
   * @param compiler the compiler to use to emit code.
   * @param globalDeclarations the global declarations that need initialization.
   */
  private entrypoint(compiler: Compiler, globalDeclarations: GlobalDeclaration[]): Directive[] {
    const directives: Directive[] = [];

    // Setup SP and ONE
    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(Compiler.SP, new ImmediateConstant(VM.DEFAULT_MEMORY_SIZE - 1)).comment('configure sp'),
      new ConstantDirective(Compiler.ONE, new ImmediateConstant(0x1)).comment('configure one'),
    ]);
    directives.push(...compiler.compile());

    // Emit global initialization code
    globalDeclarations.forEach((declaration) => {
      directives.push(...declaration.compileInit());
    });

    // Call main (use a fresh compiler since we already compiled the setup)
    const mainCompiler = new Compiler('entrypoint');
    const mr = mainCompiler.allocateRegister();
    mainCompiler.emit([
      new ConstantDirective(mr, new ReferenceConstant(new Reference(LowLevelProgram.ENTRYPOINT))),
    ]);
    const ret = mainCompiler.emitCall([], mr);
    mainCompiler.emit([
      new InstructionDirective(Instruction.createOperation(Operation.MOV, Compiler.RET, ret)),
      new InstructionDirective(Instruction.createOperation(Operation.HALT)),
    ]);
    directives.push(...mainCompiler.compile());

    return directives;
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
  public static concat(programs: LowLevelProgram[]): LowLevelProgram {
    const declaration = NamespaceDeclaration.concat(LowLevelProgram.GLOBAL_NAMESPACE, programs.map((program) => {
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
  public static parse(programText: string, filename?: string): LowLevelProgram {
    // HACK: I couldn't figure out how to allow a file that is *just* a comment, no trailing
    // newline, since you can't match on EOL it seems.
    return parseFile(parse, programText + '\n', filename);
  }
}

export {
  Declaration,
  TemplateTypeDeclaration, TypeDeclaration, GlobalDeclaration, FunctionDeclaration,
  UsingDeclaration, NamespaceDeclaration,
  TemplateFunctionDeclaration,

  LowLevelProgram,
};
