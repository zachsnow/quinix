import { Immediate } from '../lib/base-types';
import { indent, HasTags, Location, HasLocation, InternalError, mixin, SymbolTable, unique, duplicates } from '../lib/util';
import { TypeChecker, KindChecker } from './typechecker';
import { TypeTable } from './tables';

///////////////////////////////////////////////////////////////////////
// Types.
///////////////////////////////////////////////////////////////////////
function type(constructor: Function){
  const kindcheck = constructor.prototype.kindcheck;
  constructor.prototype.kindcheck = function(context: TypeChecker, kindchecker: KindChecker){
    kindcheck.call(this, context, kindchecker);
    this._concreteType = this.resolve(context);
  };
}

/**
 * The abstract base class for QLL types.
 */
abstract class Type extends mixin(HasTags, HasLocation) {
  /**
   * Check that the type is valid, recording errors on the given `context`.
   * `kindchecker` is used to verify recursive types are valid.
   *
   * @param context the context in which to kindcheck.
   * @param kindchecker the kind-checking context in which to kindcheck.
   */
  public abstract kindcheck(context: TypeChecker, kindchecker: KindChecker): void;

  /**
   * Checks type equality. Type names *are not* resolved. This means that
   * e.g. `byte` is not equal to `int` when `type int = byte`.
   *
   * @param type the type to check for equality with this type.
   */
  public isEqualTo(type: Type){
    const emptyContext = new TypeChecker();
    return this.isUnifiableWith(type, emptyContext);
  }

  /**
   * Checks type convertibility. Type names *are* resolved. This means
   * that e.g. `byte` is convertible to `int` when `type int = byte`.
   *
   * @param type the type to check for convertibility with this type.
   * @param context the context in which to check convertibility.
  */
  public isConvertibleTo(type: Type, context: TypeChecker): boolean {
    return this.isUnifiableWith(type, context);
  }

  /**
   * Core type equality implementation. Base classes should implement this
   * and perform type name resolution using `context`. Consumers of this
   * module should always check equality/convertibility using `isEqualTo`
   * or `isConvertibleTo`.
   *
   * NOTE: for now we are implementing *invariant* type equality checking.
   *
   * @param type the type to unify with.
   * @param context the context in which to resolve type names.
   *
   * @internal
   */
  public abstract isUnifiableWith(type: Type, context: TypeChecker): boolean;

  /**
   * Substitute the given type-table, returning an instantiated type.
   * The given `typeTable` is a substitution mapping identifiers to
   * types.
   *
   * @param typeTable the substitution to substitute.
   */
  public abstract substitute(typeTable: TypeTable): Type;

  /**
   * Return a string identifier that uniquely identifies this
   * type. Equal types (ideally up to alpha-conversion, but that's not
   * required) should have equal identifiers, non-equal types must
   * have non-equal identifiers.
   */
  public abstract toIdentity(): string;

  private _concreteType?: Type;

  /**
   * Returns the concrete type of this type.
   */
  public get concreteType(): Type {
    if(!this._concreteType){
      throw new InternalError(this.withLocation(`${this} has not been kindchecked`));
    }
    return this._concreteType;
  }

  public get kindchecked(): boolean {
    return !!this._concreteType;
  }

  /**
   * Resolves the type to its concrete type.
   *
   * @param context the context in which to resolve type names.
   */
  public resolve(context: TypeChecker): Type {
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
  public isIntegral(context?: TypeChecker): boolean {
    const cType = context ? this.resolve(context) : this;
    return (
      cType instanceof PointerType ||
      cType instanceof FunctionType ||
      (cType instanceof ArrayType && cType.length === undefined) ||
      (cType instanceof BuiltinType && cType.size === 1)
    );
  }

  /**
   * A numeric type can be used with arithmetic operators and as
   * an array index.
   *
   * @param context the context in which to resolve type names.
   */
  public isNumeric(context: TypeChecker): boolean {
    return this.isConvertibleTo(Type.Byte, context);
  }

  /**
   * The compile-time size of this type. Integral types are always
   * size `1`, but `struct` types *may* have `size > 1`.
   */
  public get size(): number {
    return 1;
  }
}
interface Type extends HasTags, HasLocation {}

type Storage = 'global' | 'function' | 'parameter' | 'local';

class TypedStorage {
  public readonly type: Type;
  public readonly storage: Storage;
  public constructor(type: Type, storage: Storage){
    this.type = type;
    this.storage = storage;
  }
}

class TypedIdentifier {
  public identifier: string;
  public type: Type;

  public constructor(identifier: string, type: Type){
    this.identifier = identifier;
    this.type = type;
  }

  public toString(){
    return `${this.identifier}: ${this.type}`;
  }

  public get size(): number {
    return this.type.size;
  }
}

const Builtins = ['byte', 'void', 'bool', '<error>'] as const;
type Builtin = (typeof Builtins)[number];


/**
 * Represets the built-in base types supported by QLL.
 */
@type
class BuiltinType extends Type {
  private builtin: Builtin;

  public constructor(builtin: Builtin){
    super();
    this.builtin = builtin;
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    // Builtins are always valid.
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    // Error is unifiable with any time; we will have already reported
    // the error to the user, so try not to multiply the errors unnecessarily.
    // This could hide some subsequent errors, but once the user fixes the
    // initial error that cuased this instance of `<error>`, the subsequent
    // errors will be revealed.
    if(this.builtin === '<error>'){
      return true;
    }

    // Otherwise, are only unifiable with equal builtins.
    type = type.resolve(context);
    if(type instanceof BuiltinType){
      return this.builtin === type.builtin;
    }

    return false;
  }

  public isConvertibleTo(type: Type, context: TypeChecker): boolean {
    // Really we should make `bool` an identifer, but then we need a "default"
    // typechecking context. So we'll make it a builtin, but allow
    // conversion between byte and bool.
    const convertibleBuiltins = ['byte', 'bool'];
    type = type.resolve(context);
    if(type instanceof BuiltinType){
      return this.builtin === type.builtin || (
        convertibleBuiltins.indexOf(this.builtin) !== -1 &&
        convertibleBuiltins.indexOf(type.builtin) !== -1
      );
    }
    return false;
  }

  public toString(minimal: boolean = false){
    return this.withTags(this.builtin);
  }

  public toIdentity(){
    return this.builtin;
  }

  public get size(): number {
    return this.builtin === 'void' ? 0 : 1;
  }

  public substitute(typeTable: TypeTable) {
    return new BuiltinType(this.builtin).at(this.location);
  }
}

@type
class VariableType extends Type {
  private static id = 0;
  private id: number = VariableType.id++;

  public constructor(public binding?: Type){
    super();
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    throw new InternalError();
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    if(this.binding){
      return this.binding.isUnifiableWith(type, context);
    }
    this.binding = type;
    return true;
  }

  public get size(): number {
    throw new InternalError();
  }

  public toIdentity(): string {
    throw new InternalError();
  }

  public toString(): string {
    if(this.binding){
      return `'${this.id} -> ${this.binding}`;
    }
    return `'${this.id}`;
  }

  public substitute(typeTable: TypeTable): Type {
    throw new InternalError();
  }
}

@type
class FunctionType extends Type {
  public constructor(
    /**
     * The function's template type variables, if any.
     */
    public readonly typeVariables: string[],

    /**
     * Function argument types.
     */
    public readonly argumentTypes: Type[],

    /**
     * Function return type.
     */
    private returnType: Type,

    /**
     * If this is a template function, the `instantiator` is called
     * whenever the template is instantiated.
     */
    private instantiator?: (context: TypeChecker, type: FunctionType) => void
  ){
    super();

    if(typeVariables.length && !instantiator){
      throw new InternalError(`expected instantiator for variables ${typeVariables.join(', ')}`);
    }
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    if(this.typeVariables.length){
      // Validate type variables.
      const duplicateTypeVariables = duplicates(this.typeVariables);
      if(duplicateTypeVariables.length){
        this.error(context, `duplicate type variables ${duplicateTypeVariables.join(', ')}`);
      }

      // Defer kindchecking the function type until instantiation time.
      return;
    }

    // Otherwise we can kindcheck immediately.
    const nestedKindchecker = kindchecker.pointer();
    this.returnType.kindcheck(context, nestedKindchecker);
    this.argumentTypes.forEach((type) => {
      type.kindcheck(context, nestedKindchecker);
      if(type.isConvertibleTo(Type.Void, context)){
        this.error(context, `invalid void argument`);
      }
    });
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    const concreteType = type.resolve(context);

    if(concreteType instanceof FunctionType){
      // Can't unify uninstantiated template functions.
      if(this.typeVariables.length){
        return false;
      }

      // Return types must unify.
      if(!this.returnType.isUnifiableWith(concreteType.returnType, context)){
        return false;
      }

      // Arity must match.
      if(this.arity !== concreteType.arity){
        return false;
      }

      // Argument types must unify.
      return this.argumentTypes.every((argType, i) => {
        // Reverse order for proper variance.
        return concreteType.argumentTypes[i].isUnifiableWith(argType, context);
      });
    }

    return false;
  }

  /**
   * Instantiate this template function type with the given type arguments.
   *
   * @param context the context in which this template is being instantiated.
   * @param typeArgs the type arguments with which to instantiate this template.
   */
  public instantiate(context: TypeChecker, typeArgs: Type[], source?: Location): FunctionType {
    // Can't instantiate a function that hasn't been kindchecked.
    if(!this.kindchecked){
      throw new InternalError(`${this} has not been kindchecked`);
    }

    // Check that we passed the right number of arguments.
    if(this.typeVariables.length !== typeArgs.length){
      this.error(context, `expected ${this.typeVariables.length} type arguments, actual ${typeArgs.length}`);
    }

    // Build a substitution mapping type variables to type arguments.
    const typeTable = new TypeTable();
    this.typeVariables.forEach((tv, i) => {
      typeTable.set(tv, typeArgs[i] || Type.Error);
    });

    // Substitute the type with the mapping, removing type variables.
    // Now it will be unifiable etc.
    const type = new FunctionType([], this.argumentTypes, this.returnType).at(this.location);
    const iType = type.substitute(typeTable).tag(this.tags);

    // Kindcheck.
    iType.kindcheck(context, new KindChecker());

    // Call the instantiator so we can typecheck.
    if(this.instantiator){
      const instantiationContext = context.fromSource(source || this.location);
      this.instantiator(instantiationContext, iType);
    }

    return iType;
  }

  public infer(context: TypeChecker, argTypes: Type[], contextual?: Type, source?: Location): FunctionType {
    // Construct the expected type of the function after instantiation;
    // the return type is the contextual type if it is given. We don't always
    // have one, in which case we infer one via unification.
    const returnType = contextual || new VariableType();
    const expected = new FunctionType([], argTypes, returnType).at(this.location);

    // Build a substitution mapping type variables to new variables
    // that can bind during unification.
    const typeTable = new TypeTable();
    const typeArgs: VariableType[] = [];
    this.typeVariables.forEach((tv, i) => {
      const type = new VariableType();
      typeTable.set(tv, type);
      typeArgs.push(type);
    });

    // Construct a new function with no type variables, substituting
    // with the mapping.
    const actual = new FunctionType(
      [],
      this.argumentTypes.map((argumentType) => argumentType.substitute(typeTable)),
      this.returnType.substitute(typeTable),
    ).at(this.location);

    // If the types can't unify, there's no inferred instantation.
    if(!expected.isUnifiableWith(actual, context)){
      return this;
    }

    // If we can't infer *all* type variables, there's no inferred instantiation.
    //
    // TODO: build a smaller substitution so we can see what we inferred.
    if(!typeArgs.every((arg) => !!arg.binding)){
      return this;
    }

    // Otherwise, we inferred an instantiation. Extract it and instantiate
    // this template function.
    return this.instantiate(context, typeArgs.map((arg) => arg.binding!), source);
  }

  public substitute(typeTable: TypeTable): FunctionType {
    return new FunctionType(
      this.typeVariables,
      this.argumentTypes.map((argumentType) => argumentType.substitute(typeTable)),
      this.returnType.substitute(typeTable),
      this.instantiator,
    ).at(this.location);
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
  public apply(){
    return this.returnType;
  }

  public toIdentity(){
    const args = this.argumentTypes.map((arg) => arg.toIdentity()).join(', ');
    return `(${args}) => ${this.returnType.toIdentity()}`;
  }

  public toString(){
    const args = this.argumentTypes.map((arg) => arg.toString()).join(', ');
    const tvs = this.typeVariables.length ? `<${this.typeVariables.join(', ')}>` : '';
    return this.withTags(`${tvs}(${args}) => ${this.returnType.toString()}`);
  }
}

@type
class IdentifierType extends Type {
  public readonly ERROR_IDENTIFIER: string = '<error>';

  private identifier: string;
  private qualifiedIdentifier?: string;

  public constructor(identifier: string){
    super();
    this.identifier = identifier;

    const builtins: string[] = Array.from(Builtins);
    if(builtins.indexOf(this.identifier) !== -1){
      throw new InternalError(this.withLocation(`invalid identifier ${this.identifier}`));
    }
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker){
    // Get the fully qualified identifier.
    const lookup = context.typeTable.lookup(context.namespace, this.identifier);
    if(lookup === undefined){
      this.error(context, `unknown type identifier ${this.identifier}`);

      // We don't have a real qualified identifier for this, but we expect
      // to have *something* during type checking. Instead of stopping compilation
      // entirely, we'll stumble along.
      this.qualifiedIdentifier = this.ERROR_IDENTIFIER;
      return;
    }

    // Save for later comparisons.
    this.qualifiedIdentifier = lookup.qualifiedIdentifier;

    // Invalid recursive reference.
    if(kindchecker.isInvalid(lookup.qualifiedIdentifier)){
      this.error(context, `recursive type ${this}`);
      return;
    }

    // Check if we have seen this and it is a valid recursive type;
    // if so we are done.
    if(kindchecker.isRecursive(lookup.qualifiedIdentifier)){
      return;
    }

    // Otherwise, kindcheck the body of the type.
    lookup.value.kindcheck(context, kindchecker.visit(lookup.qualifiedIdentifier));
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    if(this.qualifiedIdentifier === undefined){
      throw new InternalError(this.withLocation(`${this} has not been kindchecked`));
    }

    // Nominal equality to support recursive types.
    if(type instanceof IdentifierType){
      if(type.qualifiedIdentifier === undefined){
        throw new InternalError(type.withLocation(`${type} has not been kindchecked`));
      }

      if(this.qualifiedIdentifier === type.qualifiedIdentifier){
        return true;
      }

      // If we've already shown an error associated with this identifier,
      // just shut up about it.
      if(this.qualifiedIdentifier === this.ERROR_IDENTIFIER){
        return true;
      }
    }

    const thisType = this.resolve(context);

    // This type has no underlying mapped type in the current context.
    if(thisType === this){
      return false;
    }

    // Otherwise this type resolved to another type.
    return thisType.isUnifiableWith(type, context);
  }

  public resolve(context: TypeChecker): Type {
    // Identifiers resolve to their named type, if there is one.
    // Otherwise they resolve to themselves.
    const lookup = context.typeTable.lookup(context.namespace, this.identifier);
    if(lookup !== undefined){
      return lookup.value;
    }

    // For now this type will have failed to kind-check already, so
    // skip adding another error and just return something.
    return this;
  }

  public substitute(typeTable: TypeTable): Type {
    // If we have bound this type variable, replace it, otherwise leave it alone.
    if(typeTable.has(this.identifier)){
      return typeTable.get(this.identifier);
    }
    return this;
  }

  public get size(): number {
    throw new InternalError(this.withLocation(`unable to determine size of identifier type ${this.identifier}`));
  }

  public toIdentity(){
    return this.identifier;
  }

  public toString(){
    return this.withTags(this.identifier);
  }

  public static build(identifier: string): Type {
    const builtin = identifier as Builtin;
    if(Builtins.indexOf(builtin) !== -1){
      return new BuiltinType(builtin)
    }
    return new IdentifierType(identifier);
  }
}

@type
class PointerType extends Type {
  private type: Type;

  public constructor(type: Type){
    super();
    this.type = type;
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker){
    // Passing through a pointer tells the kindchecker that all of the types
    // we've seen inside a structure are valid.
    this.type.kindcheck(context, kindchecker.pointer());
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    // Pointers are unifiable when the types that they point to are unifiable.
    const concreteType = type.resolve(context);
    if(concreteType instanceof PointerType){
      return this.type.isUnifiableWith(concreteType.type, context);
    }
    return false;
  }

  public dereference(): Type {
    return this.type;
  }

  public toIdentity() {
    return `* ${this.type.toIdentity()}`;
  }

  public toString(){
    return this.withTags(`* ${this.type}`);
  }

  public substitute(typeTable: TypeTable): Type {
    return new PointerType(this.type.substitute(typeTable)).at(this.location);
  }
}

@type
class ArrayType extends Type {
  public constructor(private type: Type, public readonly length?: number){
    super();
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker){
    // Passing through a pointer makes a recursive reference valid.
    this.type.kindcheck(context, kindchecker.pointer());
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    // Pointers are unifiable when the types that they point to are unifiable.
    const concreteType = type.resolve(context);
    if(concreteType instanceof ArrayType){
      if(this.type.isUnifiableWith(concreteType.type, context)){
        // We can convert from sized array to unsized array, but not the opposite.
        return this.length === concreteType.length || (this.length === undefined);
      }
    }

    return false;
  }

  public index(): Type {
    return this.type;
  }

  public static build(type: Type, lengths: (number|undefined)[]): Type {
    return lengths.reduce((type, length) => {
      return new ArrayType(type, length);
    }, type);
  }

  public get size(): number {
    // Include space for capacity and size for stack-allocated arrays.
    if(this.length !== undefined){
      return this.length + 2;
    }
    return 1;
  }

  public substitute(typeTable: TypeTable): Type {
    return new ArrayType(this.type.substitute(typeTable), this.length).at(this.location);
  }

  public toString(){
    return this.withTags(`${this.type}[${this.length === undefined ? '' : Immediate.toString(this.length, 1)}]`);
  }

  public toIdentity(){
    return `${this.type.toIdentity()}[${this.length === undefined ? '' : Immediate.toString(this.length, 1)}]}`;
  }
}

type Member = {
  identifier: string;
  type: Type;
}

@type
class StructType extends Type {
  public members: Member[];

  public constructor(members: Member[]){
    super();
    this.members = members;
  }

  public member(identifier: string): Member | undefined {
    return this.members.find((member) => {
      return member.identifier === identifier;
    });
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker){
    // Passing through a structure.
    const nestedKindchecker = kindchecker.struct();

    // A struct type is valid if its members are valid.
    this.members.forEach((member) => {
      member.type.kindcheck(context, nestedKindchecker);
      if(member.type.isConvertibleTo(Type.Void, context)){
        this.error(context, `invalid void struct member`);
      }
    });
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    const concreteType = type.resolve(context);

    if(concreteType instanceof StructType){
      // Struct types have structural equality. They should have the
      // exact same number, order, and type of members.
      if(this.members.length !== concreteType.members.length){
        return false;
      }

      const matches = this.members.map((member, i) => {
        const otherMember = concreteType.members[i];
        return (
          member.identifier === otherMember.identifier &&
          member.type.isUnifiableWith(otherMember.type, context)
        );
      });

      return matches.indexOf(false) === -1;
    }

    return false;
  }

  public offset(identifier: string, context: TypeChecker): number {
    let offset = 0;
    const member = this.members.find((member) => {
      if(member.identifier === identifier){
        return true;
      }
      offset += member.type.concreteType.size;
    });

    if(member === undefined){
      throw new InternalError(this.withLocation(`invalid struct member ${identifier} (${this.members})`));
    }
    return offset;
  }

  public get size(): number {
    let size = 0;
    this.members.forEach((member) => {
      size += member.type.concreteType.size;
    });
    return size;
  }

  public toString(){
    const members = this.members.map((member) => {
      return `${member.identifier}: ${member.type};`;
    }).join('\n');

    return this.withTags('struct {' + indent('\n' + members) + '\n}');
  }

  public toIdentity(){
    const members = this.members.map((member) => {
      return `${member.identifier}: ${member.type.toIdentity()};`;
    }).join('\n');

    return 'struct {' + indent('\n' + members) + '\n}';
  }

  public substitute(typeTable: TypeTable): Type {
    return new StructType(this.members.map((member) => {
      return {
        identifier: member.identifier,
        type: member.type.substitute(typeTable),
      };
    })).at(this.location);
  }
}

namespace Type {
  export const Void = new BuiltinType('void');
  export const Byte = new BuiltinType('byte');
  export const Bool = new BuiltinType('bool');
  export const Error = new BuiltinType('<error>');

  Void.kindcheck(new TypeChecker(), new KindChecker());
  Byte.kindcheck(new TypeChecker(), new KindChecker());
  Error.kindcheck(new TypeChecker(), new KindChecker());
  Bool.kindcheck(new TypeChecker(), new KindChecker());
}

export {
  Type, TypedIdentifier,
  Storage, TypedStorage,
  BuiltinType, IdentifierType, PointerType, ArrayType, StructType, FunctionType,
}
