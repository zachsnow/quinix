import { Immediate } from '@/lib/types';
import { indent, InternalError, Syntax, Location, duplicates, writeOnce, IFileRange, IParseOptions } from '@/lib/util';
import { TypeChecker, KindChecker, Source } from './typechecker';
import { TypeTable } from './tables';

///////////////////////////////////////////////////////////////////////
// Types.
///////////////////////////////////////////////////////////////////////
/**
 * The abstract base class for QLL types.
 */
abstract class Type extends Syntax {
  /**
   * Check that the type is valid, recording errors on the given `context`.
   * `kindchecker` is used to verify that type *definitions* are valid.
   *
   * @param context the context in which to kindcheck.
   * @param kindchecker the kind-checking context in which to kindcheck.
   */
  public abstract kindcheck(context: TypeChecker, kindchecker: KindChecker): void;

  /**
   * Substitute the given type-table, returning an instantiated type.
   * The given `typeTable` is a substitution mapping identifiers to
   * types.
   *
   * @param typeTable the substitution to substitute.
   */
  public abstract substitute(typeTable: TypeTable): Type;

  /**
   * Core type equality implementation. Base classes should implement this
   * and perform type name resolution using `context`. Consumers of this
   * module should always check equality/convertibility using `isEqualTo`
   * or `isConvertibleTo`.
   *
   * NOTE: for now we are implementing *invariant* type equality checking.
   *
   * @param type the type to unify with.
   * @param nominal whether to require exact nominal equality for identifier
   * comparisons.
   *
   * @internal
   */
  public abstract isUnifiableWith(type: Type, nominal: boolean): boolean;

  /**
   * Checks type equality. Type names *are not* resolved. This means that
   * e.g. `byte` is not equal to `int` when `type int = byte`.
   *
   * @param type the type to check for equality with this type.
   */
  public isEqualTo(type: Type) {
    return this.isUnifiableWith(type, true);
  }

  /**
   * Checks type convertibility. Type names *are* resolved. This means
   * that e.g. `byte` is convertible to `int` when `type int = byte`.
   *
   * @param type the type to check for convertibility with this type.
  */
  public isConvertibleTo(type: Type): boolean {
    return this.isUnifiableWith(type, false);
  }

  /**
   * Resolves identifier types to their underlying scalar type.
   */
  public resolve(): Type {
    return this.evaluate();
  }

  /**
   * Evaluates structured types to scalar types. For instance,
   * evaluatates `(struct { t: byte }).t` to `byte`.
   *
   * TODO: maybe we want to be able to evaluate to the outermost
   * "unnecessary" name?
   */
  public evaluate(): Type {
    return this;
  }

  /**
   * Whether this type resolves to an integral type.
   *
   * An integral type can be used in a boolean context, e.g. with `if`.
   * It is either a pointer (including an array or function pointer),
   * or is convertible to a byte.
   *
   * @param context the context in which to resolve type names.
   */
  public get integral(): boolean {
    const cType = this.resolve();
    return (
      cType instanceof PointerType ||
      cType instanceof FunctionType ||
      (cType instanceof ArrayType && cType.length === undefined) ||
      (cType instanceof BuiltinType)
    );
  }

  /**
   * A numeric type can be used with arithmetic operators and as
   * an array index.
   *
   * @param context the context in which to resolve type names.
   */
  public get numeric(): boolean {
    return this.isConvertibleTo(Type.Byte);
  }

  /**
   * The compile-time size of this type. Integral types are always
   * size `1`, but `struct` types *may* have `size > 1`.
   */
  public get size(): number {
    return 1;
  }

  public get err(): boolean {
    return false;
  }
}

type Storage = 'global' | 'function' | 'parameter' | 'local';

class TypedStorage {
  public constructor(
    public readonly type: Type,
    public readonly storage: Storage,
  ) {
    this.type = type;
    this.storage = storage;
  }

  public toString() {
    return `.${this.storage} ${this.type}`;
  }
}

class TypedIdentifier {
  public identifier: string;
  public type: Type;

  public constructor(identifier: string, type: Type) {
    this.identifier = identifier;
    this.type = type;
  }

  public toString() {
    return `${this.identifier}: ${this.type}`;
  }

  public get size(): number {
    return this.type.size;
  }
}

const Builtins = ['byte', 'void', '<error>'] as const;
type Builtin = (typeof Builtins)[number];


/**
 * Represets the built-in base types supported by QLL.
 */
class BuiltinType extends Type {
  private builtin: Builtin;

  public constructor(builtin: Builtin) {
    super();
    this.builtin = builtin;
  }

  public elaborate(context: TypeChecker): void { }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    // Builtins are always valid.
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    // Error is unifiable with any time; we will have already reported
    // the error to the user, so try not to multiply the errors unnecessarily.
    // This could hide some subsequent errors, but once the user fixes the
    // initial error that cuased this instance of `<error>`, the subsequent
    // errors will be revealed.
    if (this.builtin === '<error>') {
      return true;
    }

    // Otherwise, are only unifiable with equal builtins.
    const scalarType = type.evaluate();
    if (scalarType instanceof BuiltinType) {
      if (this.builtin === scalarType.builtin) {
        return true;
      }
    }

    if (nominal) {
      return false;
    }

    const resolvedType = scalarType.resolve();
    if (resolvedType instanceof BuiltinType) {
      return this.builtin === resolvedType.builtin;
    }

    return false;
  }

  public toString() {
    return this.builtin;
  }

  public substitute(typeTable: TypeTable) {
    return this;
  }

  public get err(): boolean {
    return this.builtin === '<error>';
  }
}

type Instantiator = (context: TypeChecker, kindchecker: KindChecker, type: Type, bindings: TypeTable, source: Source) => void;

class VariableType extends Type {
  private static id = 0;
  private id: number = VariableType.id++;

  public constructor(public binding?: Type) {
    super();
  }

  public elaborate(context: TypeChecker): void {
    throw new InternalError(`unable to elaborate type variable`);
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void { }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    if (this.binding) {
      return this.evaluate().isUnifiableWith(type, nominal);
    }

    this.unify(type);
    return true;
  }

  public evaluate(): Type {
    return this.binding ? this.binding.evaluate() : this;
  }

  public unify(type: Type) {
    if (this === type) {
      return this.binding || this;
    }
    if (!this.binding) {
      this.binding = type;
    }
    return this.binding;
  }

  public get size(): number {
    throw new InternalError(`unable to get size of type variable`);
  }

  public toString(): string {
    if (this.binding) {
      return `'${this.id} -> ${this.binding}`;
    }
    return `'${this.id}`;
  }

  public substitute(typeTable: TypeTable): Type {
    throw new InternalError(`unable to substitute type variable`);
  }
}

class TemplateType extends Type {
  public constructor(
    /**
     * The template's type variables.
     */
    public readonly typeVariables: readonly string[],

    /**
     * The template's underlying type; identifiers can reference the
     * type variables.
     */
    private readonly type: Type,

    /**
     * The `instantiators` are called whenever the template is instantiated.
     */
    private readonly instantiators: readonly Instantiator[] = [],
  ) {
    super();

    if (!this.typeVariables.length) {
      throw new InternalError(`no type variables for templated ${this.type}`);
    }
  }

  public substitute(typeTable: TypeTable): TemplateType {
    // If we try to substitute a template type, we need to be
    // careful of overlapping type variables. In particular: if you
    // have a substitution { A: t1, B: t2 } and a template type
    // <B>(B => A) then you should get <B>(B => t1), *not*
    // t2 => t2.
    throw new InternalError(`unable to substitute template type`);
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    const duplicateTypeVariables = duplicates(this.typeVariables);
    if (duplicateTypeVariables.length) {
      this.error(context, `duplicate type variables ${duplicateTypeVariables.join(', ')}`);
    }

    // We need to elaborate the body of the template type, but
    // we want to make sure that bound type variables are left
    // alone.
    const nestedKindchecker = kindchecker.withTypeTable(kindchecker.typeTable.extend());
    this.typeVariables.forEach((tv) => {
      nestedKindchecker.typeTable.set(tv, new IdentifierType(tv));
    });
    this.type.kindcheck(context, nestedKindchecker);
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    const substitution = new TypeTable();
    this.typeVariables.forEach((tv) => {
      substitution.set(tv, new VariableType());
    });
    const instantiatedType = this.type.substitute(substitution);
    return instantiatedType.isUnifiableWith(type, nominal);
  }

  public extendInstantiators(instantiator: Instantiator): TemplateType {
    return new TemplateType(
      this.typeVariables,
      this.type, // TODO: we should probably clone this?
      [...this.instantiators, instantiator],
    ).at(this.location).tag(this.tags);
  }

  /**
   * Instantiate this template type with the given type arguments.
   *
   * @param context the context in which this template type is being instantiated.
   * @param typeArgs the type arguments with which to instantiate this template type.
   * @param location the location of the instantiation.
   */
  public instantiate(context: TypeChecker, kindchecker: KindChecker, typeArgs: readonly Type[], location?: Location): Type {
    // Check that we passed the right number of arguments.
    if (this.typeVariables.length !== typeArgs.length) {
      this.error(context, `expected ${this.typeVariables.length} type arguments, actual ${typeArgs.join(', ')}`);
      return Type.Error;
    }

    // Build a substitution mapping type variables to type arguments.
    const typeTable = new TypeTable();
    this.typeVariables.forEach((tv, i) => {
      typeTable.set(tv, typeArgs[i]);
    });

    // Substitute the type with the mapping, removing type variables.
    // Now it will be unifiable etc.
    const iType = this.type.substitute(typeTable);

    // Extend the source with this instantiation, so that we can
    // both render nice errors that trace the instantiation, and
    // ensure that we don't recurse infinitely.
    const source = context.source.extend(
      iType.toString(),
      `instantiating ${this} to ${iType}`,
      location || this.location,
    );

    // Call the instantiators so we can typecheck the body of the function with
    // the instantiation we just developed.
    this.instantiators.forEach((instantiator) => {
      instantiator(context, kindchecker, iType, typeTable, source);
    });

    return iType;
  }

  /**
   * Infer an instantation for this template type based on the given type.
   * Either returns this type instantiated with the necessary type arguments to
   * match the given type, or `undefined` if no such instantiation was found.
   *
   * @param context the context in which this template type is being inferred.
   * @param expectedType the type we'd like instantiating this template type to
   * unify with.
   * @param location the location of the instantiation.
   */
  public infer(context: TypeChecker, kindchecker: KindChecker, expectedType: Type, location?: Location): Type | undefined {
    // Build a substitution mapping type variables to new variables
    // that can bind during unification.
    const typeTable = new TypeTable();
    const typeArgs = this.typeVariables.map((tv) => {
      const v = new VariableType();
      typeTable.set(tv, v);
      return v;
    });

    // Substitute and verify that the substitution produces a valid type.
    const actualType = this.type.substitute(typeTable);
    actualType.kindcheck(context, new KindChecker());

    // If the types can't unify, there's no inferred instantation.
    if (!expectedType.isUnifiableWith(actualType, false)) {
      return;
    }

    // If any of the type variables are unbound, we didn't find a specific
    // instantiation.
    if (typeArgs.some((arg) => arg.evaluate() instanceof VariableType)) {
      return;
    }

    // Otherwise, we inferred an instantiation. Extract it and instantiate
    // this template type.
    return this.instantiate(context, kindchecker, typeArgs.map((arg) => arg.evaluate()), location);
  }

  public toString() {
    return `<${this.typeVariables.join(', ')}>${this.type}`;
  }

  public get scalar(): boolean {
    return false;
  }
}

class TemplateInstantiationType extends Type {
  private instantiatedType!: Type;

  public constructor(
    public readonly type: Type,
    public readonly typeArguments: readonly Type[],
  ) {
    super();

    if (!this.typeArguments.length) {
      throw new InternalError(`template instantiation with no type arguments`);
    }
  }

  public substitute(typeTable: TypeTable): TemplateInstantiationType {
    return new TemplateInstantiationType(
      this.type.substitute(typeTable),
      this.typeArguments.map((type) => {
        return type.substitute(typeTable);
      }),
    ).at(this.location).tag(this.tags);
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker) {
    if (this.instantiatedType !== undefined) {
      this.instantiatedType.kindcheck(context, kindchecker);
      return;
    }

    this.type.kindcheck(context, kindchecker);
    this.typeArguments.forEach((type) => {
      type.kindcheck(context, kindchecker);
    });

    const type = this.type.resolve();
    if (!(type instanceof TemplateType)) {
      this.error(context, `expected template type, actual ${this.type}`);
      this.instantiatedType = Type.Error;
      return;
    }

    const nestedContext = context.forSource(context.source.extend(
      this.toString(),
      `instantiating ${this}`,
      this.location,
    ));

    this.instantiatedType = type.instantiate(nestedContext, kindchecker, this.typeArguments, this.location);
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    return this.evaluate().isUnifiableWith(type, nominal);
  }

  public evaluate(): Type {
    return this.instantiatedType.evaluate();
  }

  public get scalar(): boolean {
    return false;
  }

  public toString() {
    return `(${this.type})<${this.typeArguments.join(', ')}>`;
  }
}
writeOnce(TemplateInstantiationType, 'instantiatedType', true);

type Suffix = {
  identifier?: string;
  size?: number;
  range: IFileRange;
  text: string;
  options?: IParseOptions
};

class SuffixType {
  public static build(type: Type, suffixes: Suffix[]) {
    return suffixes.reduce((type, suffix) => {
      if (suffix.identifier !== undefined) {
        return new DotType(type, suffix.identifier).at(suffix.range, suffix.text, suffix.options);
      }
      else if (suffix.size !== undefined) {
        return new ArrayType(type, suffix.size).at(suffix.range, suffix.text, suffix.options);
      }
      else {
        return new SliceType(type).at(suffix.range, suffix.text, suffix.options);
      }
    }, type);
  }
}

class DotType extends Type {
  private memberType!: Type;

  public constructor(
    public readonly type: Type,
    public readonly identifier: string,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): DotType {
    return new DotType(
      this.type.substitute(typeTable),
      this.identifier,
    ).at(this.location).tag(this.tags);
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    this.type.kindcheck(context, kindchecker);

    const type = this.type.resolve();

    if (!(type instanceof StructType)) {
      this.error(context, `expected struct type, actual ${this.type}`);
      this.memberType = Type.Error;
      return;
    }

    const memberType = type.member(this.identifier);
    if (!memberType) {
      this.error(context, `unknown member ${this.identifier}`);
      this.memberType = Type.Error;
      return;
    }

    this.memberType = memberType.type;
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    return this.memberType.isUnifiableWith(type, nominal);
  }

  public evaluate(): Type {
    return this.memberType.evaluate();
  }

  public toString() {
    return `(${this.type}).${this.identifier}`;
  }

  public get scalar(): boolean {
    return false;
  }
}
writeOnce(DotType, 'memberType');

class FunctionType extends Type {
  public constructor(
    /**
     * Function argument types.
     */
    public readonly argumentTypes: readonly Type[],

    /**
     * Function return type.
     */
    public readonly returnType: Type,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): FunctionType {
    return new FunctionType(
      this.argumentTypes.map((argumentType) => argumentType.substitute(typeTable)),
      this.returnType.substitute(typeTable),
    ).at(this.location).tag(this.tags);
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    const nestedKindchecker = kindchecker.pointer();
    this.returnType.kindcheck(context, nestedKindchecker);
    this.argumentTypes.forEach((argumentType) => {
      argumentType.kindcheck(context, nestedKindchecker);
    });
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    const concreteType = type.resolve();
    if (concreteType instanceof FunctionType) {
      // Return types must unify.
      if (!this.returnType.isUnifiableWith(concreteType.returnType, nominal)) {
        return false;
      }

      // Arity must match.
      if (this.arity !== concreteType.arity) {
        return false;
      }

      // Argument types must unify.
      return this.argumentTypes.every((argType, i) => {
        // Reverse order for proper variance.
        return concreteType.argumentTypes[i].isUnifiableWith(argType, nominal);
      });
    }

    return false;
  }

  /**
   * Returns the arity of this function type.
   */
  public get arity() {
    return this.argumentTypes.length;
  }

  /**
   * Returns the return type of this function type.
   */
  public apply() {
    return this.returnType;
  }

  public toString() {
    const args = this.argumentTypes.map((arg) => arg.toString()).join(', ');
    return `(${args}) => ${this.returnType}`;
  }
}

class IdentifierType extends Type {
  public static readonly ErrorIdentifier: string = '<error>';

  private qualifiedIdentifier!: string;
  private type!: Type;

  public constructor(
    private readonly identifier: string,
  ) {
    super();
    this.identifier = identifier;

    const builtins: string[] = Array.from(Builtins);
    if (builtins.indexOf(this.identifier) !== -1) {
      throw new InternalError(this.withLocation(`invalid identifier ${this.identifier}`));
    }
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker) {
    const lookup = kindchecker.typeTable.lookup(this.identifier);
    const declaration = context.namespace.lookupType(context, this.identifier);

    // If we have already looked this identifier up, we're done.
    // We don't want to look up already-bound identifiers because we
    // probably just instantiated them into a new spot that is not
    // the context in which they should be looked up!
    if (this.qualifiedIdentifier !== undefined) {
      return;
    }

    if (lookup !== undefined) {
      // This is a type binding; it can't be recursive. We don't
      // save the qualified identifier because it doesn't really have
      // one.
      return;
    }
    else if (declaration !== undefined) {
      // This is a type name.

      // Save for later comparisons.
      this.qualifiedIdentifier = declaration.qualifiedIdentifier;
      this.type = declaration.type;

      // Invalid recursive reference.
      if (kindchecker.isInvalid(this.qualifiedIdentifier)) {
        this.error(context, `recursive type ${this}`);
        return;
      }

      // Valid recursive reference; we're done.
      if (kindchecker.isRecursive(this.qualifiedIdentifier)) {
        return;
      }

      // Otherwise we must pass through this type so we can verify
      // (mutually) recursive types. Make sure to reset the lookup context
      // to the declaration's namesapce.
      if (!declaration.namespace) {
        throw new InternalError(`no namespace`);
      }
      const namespaceContext = context.forNamespace(declaration.namespace);
      this.type.kindcheck(namespaceContext, kindchecker.visit(this.qualifiedIdentifier));
    }
    else {
      debugger;
      this.error(context, `unknown type identifier ${this.identifier}`);

      // We don't have a real qualified identifier for this, but we expect
      // to have *something* during type checking. Instead of stopping compilation
      // entirely, we'll stumble along.
      this.qualifiedIdentifier = IdentifierType.ErrorIdentifier;
      this.type = Type.Error;
      return;
    }
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    // If we've already shown an error associated with this identifier,
    // just shut up about it.
    if (this.qualifiedIdentifier === IdentifierType.ErrorIdentifier) {
      return true;
    }

    // Nominal equality -- we avoid resolving either side unnecessarily.
    const evaluatedType = type.evaluate();
    if (evaluatedType instanceof IdentifierType) {
      if (this.qualifiedIdentifier === evaluatedType.qualifiedIdentifier) {
        return true;
      }
    }

    if (nominal) {
      return false;
    }

    // Otherwise check the type we're bound to.
    return this.type.isUnifiableWith(evaluatedType.resolve(), nominal);
  }

  public substitute(typeTable: TypeTable): Type {
    // If we have bound this type variable, replace it with
    // the value we bound in the type table.
    if (typeTable.has(this.identifier)) {
      return typeTable.get(this.identifier).value;
    }

    // Otherwise, it's just a regular type identifier.
    const t = new IdentifierType(
      this.identifier,
    ).at(this.location).tag(this.tags);

    // We should only encounter elaborated identifiers because we should have
    // already kindchecked the body of any type before we instantiate it.
    //
    // TODO: this is not the case, we might instantiate before kindchecking,
    // for instance type t = foo<bar>; type foo<T> = T[]. If we kindcheck
    // `t` first we will instantiate `foo` before we've kindchecked it.
    t.qualifiedIdentifier = this.qualifiedIdentifier;
    t.type = this.type;

    return t;
  }

  public resolve(): Type {
    // Resolve *all* identifier bindings to find underlying type.
    return this.type.resolve();
  }

  public get size(): number {
    return this.type.size;
  }

  public toString() {
    return this.identifier;
  }
}
writeOnce(IdentifierType, 'qualifiedIdentifier', true);
writeOnce(IdentifierType, 'type', true);

class PointerType extends Type {
  private type: Type;

  public constructor(type: Type) {
    super();
    this.type = type;
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker) {
    // Passing through a pointer tells the kindchecker that all of the types
    // we've seen inside a structure are valid.
    this.type.kindcheck(context, kindchecker.pointer());
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    // Pointers are unifiable when the types that they point to are unifiable.
    type = nominal ? type.evaluate() : type.resolve();
    if (type instanceof PointerType) {
      return this.type.isUnifiableWith(type.type, nominal);
    }

    // Pointers to arrays are convertible to slices: * T[N] → T[]
    if (type instanceof SliceType) {
      const deref = this.type.resolve();
      if (deref instanceof ArrayType) {
        return deref.index().isUnifiableWith(type.index(), nominal);
      }
    }

    return false;
  }

  public dereference(): Type {
    return this.type;
  }

  public toString() {
    return `* ${this.type}`;
  }

  public substitute(typeTable: TypeTable): Type {
    return new PointerType(
      this.type.substitute(typeTable),
    ).at(this.location).tag(this.tags);
  }
}

class ArrayType extends Type {
  public constructor(
    private type: Type,
    public readonly length: number,
  ) {
    super();
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker) {
    // Arrays do not allow recursive references (unlike pointers/slices).
    this.type.kindcheck(context, kindchecker);
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    type = nominal ? type.evaluate() : type.resolve();

    // Arrays unify with arrays of same element type and exact same length.
    if (type instanceof ArrayType) {
      if (this.type.isUnifiableWith(type.type, nominal)) {
        return this.length === type.length;
      }
    }

    // Arrays also unify with slices of the same element type (implicit conversion).
    if (type instanceof SliceType) {
      return this.type.isUnifiableWith(type.index(), nominal);
    }

    return false;
  }

  public index(): Type {
    return this.type;
  }

  public get size(): number {
    // Layout: [length][elem0][elem1]...[elemN-1]
    return 1 + this.length * this.type.size;
  }

  public substitute(typeTable: TypeTable): Type {
    return new ArrayType(
      this.type.substitute(typeTable),
      this.length,
    ).at(this.location).tag(this.tags);
  }

  public toString() {
    return `${this.type}[${Immediate.toString(this.length, 1)}]`;
  }
}

class SliceType extends Type {
  public constructor(
    private type: Type,
  ) {
    super();
  }

  /**
   * Check if a type is slice-like (either a SliceType or a struct with the
   * canonical slice shape: { pointer: * T; length: byte; capacity: byte; }).
   *
   * Note: Uses full field names "length" and "capacity" to avoid keyword conflicts.
   * The `cap` keyword is the operator; struct fields use descriptive names.
   */
  public static isSliceLike(type: Type): boolean {
    type = type.resolve();

    if (type instanceof SliceType) {
      return true;
    }

    if (type instanceof StructType) {
      if (type.members.length !== 3) {
        return false;
      }

      const pointer = type.members[0];
      const length = type.members[1];
      const capacity = type.members[2];

      if (pointer.identifier !== 'pointer' ||
          length.identifier !== 'length' ||
          capacity.identifier !== 'capacity') {
        return false;
      }

      const pointerType = pointer.type.resolve();
      if (!(pointerType instanceof PointerType)) {
        return false;
      }

      // Don't need to check element type unification here, just shape
      return true;
    }

    return false;
  }

  /**
   * Get slice field information for a slice-like type.
   * Returns undefined if the type is not slice-like.
   */
  public static getSliceInfo(type: Type): { elementType: Type; lengthOffset: number; capacityOffset: number; } | undefined {
    type = type.resolve();

    if (type instanceof SliceType) {
      // Slice layout: [pointer][length][capacity]
      return {
        elementType: type.type,
        lengthOffset: 1,
        capacityOffset: 2,
      };
    }

    if (type instanceof StructType && this.isSliceLike(type)) {
      // Struct layout: compute offsets from member positions
      const pointer = type.members[0];
      const pointerType = pointer.type.resolve() as PointerType;

      return {
        elementType: pointerType.dereference(),
        lengthOffset: type.members[0].type.size,  // After pointer field
        capacityOffset: type.members[0].type.size + type.members[1].type.size,  // After pointer + length
      };
    }

    return undefined;
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker) {
    // Slices contain a pointer, so recursive references are valid.
    this.type.kindcheck(context, kindchecker.pointer());
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    type = nominal ? type.evaluate() : type.resolve();

    // Slices unify with slices of the same element type.
    if (type instanceof SliceType) {
      return this.type.isUnifiableWith(type.type, nominal);
    }

    // Slices also unify with structs that have the same shape:
    // struct { pointer: * T; length: byte; capacity: byte; }
    if (type instanceof StructType) {
      if (type.members.length !== 3) {
        return false;
      }

      const pointer = type.members[0];
      const length = type.members[1];
      const capacity = type.members[2];

      if (pointer.identifier !== 'pointer' ||
          length.identifier !== 'length' ||
          capacity.identifier !== 'capacity') {
        return false;
      }

      // Check types: pointer should be * elementType, length and capacity should be byte
      const pointerType = pointer.type.resolve();
      if (!(pointerType instanceof PointerType)) {
        return false;
      }

      if (!pointerType.dereference().isUnifiableWith(this.type, nominal)) {
        return false;
      }

      if (!length.type.isUnifiableWith(Type.Byte, nominal) ||
          !capacity.type.isUnifiableWith(Type.Byte, nominal)) {
        return false;
      }

      return true;
    }

    return false;
  }

  public index(): Type {
    return this.type;
  }

  public get size(): number {
    // Layout: [pointer][length][capacity]
    return 3;
  }

  public substitute(typeTable: TypeTable): Type {
    return new SliceType(
      this.type.substitute(typeTable),
    ).at(this.location).tag(this.tags);
  }

  public toString() {
    return `${this.type}[]`;
  }
}

type Member = {
  identifier: string;
  type: Type;
}

class StructType extends Type {
  public constructor(public readonly members: readonly Member[]) {
    super();
  }

  public member(identifier: string): Member | undefined {
    return this.members.find((member) => {
      return member.identifier === identifier;
    });
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker) {
    // Passing through a structure.
    const nestedKindchecker = kindchecker.struct();

    // A struct type is valid if its members are valid.
    this.members.forEach((member) => {
      member.type.kindcheck(context, nestedKindchecker);
      if (member.type.isConvertibleTo(Type.Void)) {
        this.error(context, `invalid void struct member`);
      }
    });
  }

  public isUnifiableWith(type: Type, nominal: boolean): boolean {
    // Bind type variables.
    if (type instanceof VariableType) {
      type = type.unify(this);
    }

    type = type.resolve();

    // Struct types have structural equality. They should have the
    // exact same number, order, and type of members.
    if (type instanceof StructType) {
      const structType = type;

      if (this.members.length !== structType.members.length) {
        return false;
      }

      const matches = this.members.map((member, i) => {
        const otherMember = structType.members[i];
        return (
          member.identifier === otherMember.identifier &&
          member.type.isUnifiableWith(otherMember.type, nominal)
        );
      });

      return matches.indexOf(false) === -1;
    }

    // Structs with the shape { pointer: * T; length: byte; capacity: byte; }
    // unify with SliceType T[].
    if (type instanceof SliceType) {
      if (this.members.length !== 3) {
        return false;
      }

      const pointer = this.members[0];
      const length = this.members[1];
      const capacity = this.members[2];

      if (pointer.identifier !== 'pointer' ||
          length.identifier !== 'length' ||
          capacity.identifier !== 'capacity') {
        return false;
      }

      const pointerType = pointer.type.resolve();
      if (!(pointerType instanceof PointerType)) {
        return false;
      }

      if (!pointerType.dereference().isUnifiableWith(type.index(), nominal)) {
        return false;
      }

      if (!length.type.isUnifiableWith(Type.Byte, nominal) ||
          !capacity.type.isUnifiableWith(Type.Byte, nominal)) {
        return false;
      }

      return true;
    }

    return false;
  }

  public offset(identifier: string): number {
    let offset = 0;
    const member = this.members.find((member) => {
      if (member.identifier === identifier) {
        return true;
      }
      offset += member.type.size;
    });

    if (member === undefined) {
      throw new InternalError(this.withLocation(`invalid struct member ${identifier} (${this.members})`));
    }
    return offset;
  }

  public get size(): number {
    let size = 0;
    this.members.forEach((member) => {
      size += member.type.size;
    });
    return size;
  }

  public toString() {
    const members = this.members.map((member) => {
      return `${member.identifier}: ${member.type};`;
    }).join('\n');

    return 'struct {' + indent('\n' + members) + '\n}';
  }

  public substitute(typeTable: TypeTable): Type {
    return new StructType(this.members.map((member) => {
      return {
        identifier: member.identifier,
        type: member.type.substitute(typeTable),
      };
    })).at(this.location).tag(this.tags);
  }
}

namespace Type {
  // Builtins.
  export const Void = new BuiltinType('void');
  export const Byte = new BuiltinType('byte');
  export const Error = new BuiltinType('<error>');
}

export {
  Type, TypedIdentifier,
  TypedStorage,
  BuiltinType, IdentifierType, TemplateType, PointerType, ArrayType, SliceType, StructType, FunctionType,
  VariableType,
  TemplateInstantiationType, DotType, SuffixType,
};
export type { Storage };
