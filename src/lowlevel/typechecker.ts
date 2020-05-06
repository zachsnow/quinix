import { Messages, Location, HasLocation, InternalError } from '../lib/util';
import { TypeTable, StorageTable } from './tables';
import { Type } from './types';

type SourceInstantiation = {
  identity: string;
  message: string;
  location?: Location;
}

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

  public readonly namespace: string;
  public readonly typeTable: TypeTable;
  public readonly symbolTable: StorageTable;

  private loopCount: number = 0;
  private instantiationSource: Source = new Source();
  private checks: Check[] = [];
  private recordedReferences: string[] = [];
  private substitutionTypeTable: TypeTable = new TypeTable();

  public constructor(typeTable?: TypeTable, symbolTable?: StorageTable, namespace: string = ''){
    super();

    this.typeTable = typeTable ?? new TypeTable();
    this.symbolTable = symbolTable ?? new StorageTable();
    this.namespace = namespace;
  }

  public extend(typeTable: TypeTable | undefined, symbolTable: StorageTable | undefined, namespace?: string): TypeChecker {
    const context = new TypeChecker(
      typeTable ?? this.typeTable,
      symbolTable ?? this.symbolTable,
      namespace ?? this.namespace,
    );

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

    // Copy the current substitution; we only change it via `substitute`.
    context.substitutionTypeTable = this.substitutionTypeTable;

    context.recordedReferences = this.recordedReferences;

    return context;
  }

  public prefix(identifier: string): string {
    return this.namespace ? `${this.namespace}::${identifier}` : identifier;
  }

  public loop(): TypeChecker {
    const context = this.extend(undefined, undefined, undefined);
    context.loopCount++;
    return context;
  }

  public fromSource(source: Source): TypeChecker {
    const context = this.extend(undefined, undefined, undefined);
    context.instantiationSource = source;
    return context;
  }

  public get instantiationIdentity(): string {
    return this.instantiationSource.identity;
  }

  public get instantiationDepth(): number {
    return this.instantiationSource.depth;
  }

  public get source(): Source {
    return this.instantiationSource;
  }

  public recordReferences(): TypeChecker {
    const context = this.extend(undefined, undefined, undefined);
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

  public substitute(substitution: TypeTable){
    const context = this.extend(undefined, undefined, undefined);
    context.substitutionTypeTable = substitution;
    return context;
  }

  public substitution(identifier: string): Type | undefined {
    if(!this.substitutionTypeTable || !this.substitutionTypeTable.has(identifier)){
      return undefined;
    }
    return this.substitutionTypeTable.get(identifier);
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
   * Instantiate a new kindchecker for checking the validity of
   * a type definition. If no type is being defined, the kindchecker
   * doesn't actually do anything.
   *
   * @param qualifiedIdentifier the qualified identifier being *defined*;
   * optional.
   */
  public constructor(qualifiedIdentifier?: string){
    if(qualifiedIdentifier){
      this.directs.push(qualifiedIdentifier);
    }
  }

  /**
   * Returns a new kindchecker that marks relevant identifiers
   * as having passed through a struct.
   */
  public struct(): KindChecker {
    const kindchecker = new KindChecker();
    kindchecker.visiteds = [...this.visiteds, ...this.pointers];
    kindchecker.structs = [...this.structs, ...this.directs];
    kindchecker.pointers = [];
    kindchecker.directs = [];
    return kindchecker;
  }

  /**
   * Returns a new kindchecker that marks relevant identifiers
   * as having passed through a pointer.
   */
  public pointer(): KindChecker {
    const kindchecker = new KindChecker();
    kindchecker.visiteds = [...this.visiteds, ...this.structs];
    kindchecker.structs = [];
    kindchecker.pointers = [...this.pointers, ...this.directs];
    kindchecker.directs = [];
    return kindchecker;
  }

  /**
   * Returns a new kindchecker that has directly visited the given
   * fully qualified identifier.
   *
   * @param qualifiedIdentifier the fully qualified identifier to visit.
   */
  public visit(qualifiedIdentifier: string): KindChecker {
    const kindchecker = new KindChecker();
    kindchecker.visiteds = [...this.visiteds];
    kindchecker.structs = [...this.structs];
    kindchecker.pointers = [...this.pointers];
    kindchecker.directs = [
      ...this.directs,
      qualifiedIdentifier,
    ];
    return kindchecker;
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
