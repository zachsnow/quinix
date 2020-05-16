import { Messages, Location, InternalError } from '../lib/util';
import { TypeTable, StorageTable } from './tables';
import { Type, IdentifierType } from './types';
import { NamespaceDeclaration } from './lowlevel';
import { IdentifierExpression } from './expressions';

type SourceInstantiation = {
  identity: string;
  message: string;
  location?: Location;
}

/**
 * Represents the source of a context; namely, a list of instantiations
 * that lead to this point.
 */
class Source {
  public constructor(
    public instantiations: SourceInstantiation[] = []
  ){}

  public extend(identity: string, message: string, location?: Location){
    return new Source([...this.instantiations, {
      identity,
      message,
      location,
    }]);
  }

  public get depth(): number {
    return this.instantiations.length;
  }

  public get identity(): string {
    if(!this.depth){
      return '';
    }
    return this.instantiations[this.depth - 1].identity;
  }

  public toString(){
    return this.instantiations.map((instantiation) => {
      return instantiation.location ?
        `at: ${instantiation.location.toString()} ${instantiation.message}` :
        instantiation.message;
    }).join('\n  ');
  }
}

type Check = (context: TypeChecker) => void;

/**
 * Has environment information for typechecking; also tracks errors.
 */
class TypeChecker extends Messages {
  public static MAX_INSTANTIATION_DEPTH = 10;

  public symbolTable: StorageTable;

  private loopCount: number = 0;
  private instantiationSource: Source = new Source();
  private checks: Check[] = [];
  private recordedReferences: string[] = [];

  public constructor(
    public namespace: NamespaceDeclaration,
  ){
    super();
    this.symbolTable = new StorageTable();
  }

  public extend(symbolTable: StorageTable | undefined): TypeChecker {
    const context = new TypeChecker(
      this.namespace,
    );

    // Allow overriding the symbol table.
    context.symbolTable = symbolTable ?? this.symbolTable;

    // Always use the same messages.
    context.messages = this.messages;

    // We only enter / exit loops via `loop()`.
    context.loopCount = this.loopCount;

    // We only enter new source contexts via `fromSource`.
    // This is for making it easier to understand instantiations.
    context.instantiationSource = this.instantiationSource;

    // Always use the same checks, because we never want to discard one.
    // We only add checks via `addCheck`.
    context.checks = this.checks;

    // Use the same reference table; only update via `recordReferences`.
    context.recordedReferences = this.recordedReferences;

    return context;
  }

  public forNamespace(namespace: NamespaceDeclaration){
    const context = this.extend(undefined);
    context.namespace = namespace;
    return context;
  }

  public prefix(identifier: string): string {
    return this.namespace ? `${this.namespace}::${identifier}` : identifier;
  }

  public loop(): TypeChecker {
    const context = this.extend(undefined);
    context.loopCount++;
    return context;
  }

  public forSource(source: Source): TypeChecker {
    const context = this.extend(undefined);
    context.instantiationSource = source;
    return context;
  }

  public get instantiationDepth(): number {
    return this.instantiationSource.depth;
  }

  public get source(): Source {
    return this.instantiationSource;
  }

  public recordReferences(): TypeChecker {
    const context = this.extend(undefined);
    context.recordedReferences = [];
    return context;
  }

  public reference(ref: string){
    this.recordedReferences.push(ref);
  }

  public get references(): string[] {
    return this.recordedReferences;
  }

  public error(message: string, location?: Location){
    const prefix = this.source.toString();
    super.error(prefix ? `\n  ${prefix}\n  ${message}` : message, location);
  }

  public warning(message: string, location?: Location){
    const prefix = this.source.toString();
    super.warning(prefix ? `\n  ${prefix}\n  ${message}` : message, location);
  }

  public get inLoop(): boolean {
    return this.loopCount > 0;
  }

  public addCheck(check: Check): void {
    this.checks.push(check);
  }

  public check(): void {
    this.checks.forEach((check) => {
      check(this);
    });
  }

  public builtinType(identifier: string): Type {
    const type = new IdentifierType(identifier);
    type.kindcheck(this, new KindChecker());
    return type;
  }
}

class KindChecker {
  /**
   * The types that we have already seen that are
   * now valid in a recursive context because we've
   * passed through a struct and a pointer.
   */
  private visiteds: string[] = [];

  /**
   * The types that we have already seen for which
   * we have passed through a struct.
   */
  private structs: string[] = [];

  /**
   * The types that we have already seen for which
   * we have passed through a pointer. This includes
   * regular pointers, arrays, and function pointers.
   */
  private pointers: string[] = [];

  /**
   * The types that we have seen for which we
   * have not passed through either a pointer or a struct.
   */
  private directs: string[] = [];


  /**
   * The current type table; for substitutions only (we
   * don't allow 'local' type declarations for now).
   */
  public typeTable: TypeTable = new TypeTable();

  /**
   * Instantiate a new kindchecker for checking the validity of
   * a type definition. If no type is being defined, the kindchecker
   * doesn't actually do anything.
   *
   * @param qualifiedIdentifier the qualified identifier being *defined*;
   * optional.
   */
  public constructor(qualifiedIdentifier?: string, typeTable?: TypeTable){
    if(qualifiedIdentifier){
      this.directs.push(qualifiedIdentifier);
    }
    if(typeTable){
      this.typeTable = typeTable;
    }
  }

  public withTypeTable(typeTable: TypeTable): KindChecker {
    const kindchecker = this.extend();
    kindchecker.typeTable = typeTable;
    return kindchecker;
  }

  private extend(visiteds?: string[], structs?: string[], pointers?: string[], directs?: string[]): KindChecker {
    const kindchecker = new KindChecker();
    kindchecker.visiteds = visiteds || [...this.visiteds];
    kindchecker.structs = structs || [...this.structs];
    kindchecker.pointers = pointers || [...this.pointers];
    kindchecker.directs = directs || [...this.directs];
    kindchecker.typeTable = this.typeTable;
    return kindchecker;
  }

  /**
   * Returns a new kindchecker that marks relevant identifiers
   * as having passed through a struct.
   */
  public struct(): KindChecker {
    return this.extend(
      [...this.visiteds, ...this.pointers],
      [...this.structs, ...this.directs],
      [],
      [],
    );
  }

  /**
   * Returns a new kindchecker that marks relevant identifiers
   * as having passed through a pointer.
   */
  public pointer(): KindChecker {
    return this.extend(
      [...this.visiteds, ...this.structs],
      [],
      [...this.pointers, ...this.directs],
      [],
    );
  }

  /**
   * Returns a new kindchecker that has directly visited the given
   * fully qualified identifier.
   *
   * @param qualifiedIdentifier the fully qualified identifier to visit.
   */
  public visit(qualifiedIdentifier: string): KindChecker {
    return this.extend(
      undefined,
      undefined,
      undefined,
      [ ...this.directs, qualifiedIdentifier ],
    );
  }

  /**
   * Returns `true` if the given fully qualified identifier
   * is recursively invalid in this kindchecker.
   *
   * @param qualifiedIdentifier the fully qualified identifier to
   * check for validity.
   */
  public isInvalid(qualifiedIdentifier: string): boolean {
    return this.structs.indexOf(qualifiedIdentifier) !== -1 ||
      this.pointers.indexOf(qualifiedIdentifier) !== -1 ||
      this.directs.indexOf(qualifiedIdentifier) !== -1;
  }

  /**
   * Returns `true` if the given fully qualified identifier
   * is *recursively* valid in this kindchecker; note that this
   * is not just the inverse of `isInvalid` -- it must appear
   * recursively (that is, it must be the type that this kindchecker
   * is analyzing).
   *
   * @param qualifiedIdentifier the fully qualified identifier
   * to check for recursive validity.
   */
  public isRecursive(qualifiedIdentifier: string): boolean {
    return this.visiteds.indexOf(qualifiedIdentifier) !== -1;
  }
}

export { TypeChecker, KindChecker, Source };
