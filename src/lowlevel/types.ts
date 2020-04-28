import { Immediate } from '../lib/base-types';
import { indent, HasTags, HasLocation, InternalError, mixin, SymbolTable } from '../lib/util';
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
   * Check that the type is valid.
   *
   * @param context
   * @param visitedTypes the type identifiers that have been passed through.
   */
  public abstract kindcheck(context: TypeChecker, kindchecker: KindChecker): void;

  /**
   * Checks type equality. Type names *are not* resolved. This means that
   * e.g. `byte` is not equal to `int` when `type int = byte`.
   *
   * @param type
   */
  public isEqualTo(type: Type, context: TypeChecker){
    const emptyContext = context.extend(new TypeTable(), new SymbolTable());
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
   abstract isUnifiableWith(type: Type, context: TypeChecker): boolean;

  private _concreteType?: Type;
  public get concreteType(): Type {
    if(!this._concreteType){
      throw new InternalError(this.withLocation(`${this} has not been kindchecked`));
    }
    return this._concreteType;
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

  public toString(){
    return this.withTags(this.builtin);
  }

  public get size(): number {
    return this.builtin === 'void' ? 0 : 1;
  }
}

@type
class FunctionType extends Type {
  private returnType: Type;
  public argumentTypes: Type[];

  public constructor(argumentTypes: Type[], returnType: Type){
    super();
    this.returnType = returnType;
    this.argumentTypes = argumentTypes;
  }

  public kindcheck(context: TypeChecker, kindchecker: KindChecker): void {
    const nestedKindchecker = kindchecker.pointer();

    // Function types are valid so long as their argument and return types
    // are valid.
    this.returnType.kindcheck(context, nestedKindchecker);
    this.argumentTypes.forEach((type) => {
      type.kindcheck(context, nestedKindchecker);
    });
  }

  public isUnifiableWith(type: Type, context: TypeChecker): boolean {
    const concreteType = type.resolve(context);

    if(concreteType instanceof FunctionType){
      // Return types must unify.
      if(!this.returnType.isUnifiableWith(concreteType.returnType, context)){
        return false;
      }

      // Arity must match.
      if(this.arity !== concreteType.arity){
        return false;
      }

      // Argument types must unify.
      const argumentsMatch = this.argumentTypes.map((argType, i) => {
        if(!argType.isUnifiableWith(concreteType.argumentTypes[i], context)){
          return false;
        }
      });

      return argumentsMatch.indexOf(false) === -1;
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
   * Returns the type of the ith argument of this function type.
   *
   * @param i the index of the argument.
   */
  public argument(i: number): Type{
    return this.argumentTypes[i];
  }

  /**
   * Returns the return type of this function type.
   */
  public apply(){
    return this.returnType;
  }

  public toString(){
    const args = this.argumentTypes.map((arg) => arg.toString()).join(', ');
    return this.withTags(`(${args}) => ${this.returnType.toString()}`);
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

    // This type has no underlying mapped type; maybe we'll use this for
    // global abstract types? For now this should be impossible.
    if(thisType === this){
      this.error(context, `abstract type ${this}`);
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

  public get size(): number {
    throw new InternalError(this.withLocation(`unable to determine size of identifier type ${this.identifier}`));
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

  public toString(){
    return this.withTags(`* ${this.type}`);
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

  public toString(){
    return this.withTags(`${this.type}[${this.length === undefined ? '' : Immediate.toString(this.length, 1)}]`);
  }

  public static build(type: Type, lengths: (number|undefined)[]): Type {
    return lengths.reduce((type, length) => {
      return new ArrayType(type, length);
    }, type);
  }

  public get size(): number {
    return this.length === undefined ? 1 : this.length + 1;
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
      throw new InternalError(this.withLocation(`invalid member ${identifier} (${this.members})`));
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
