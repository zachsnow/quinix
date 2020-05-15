import fs from 'fs';
import debug from 'debug';

class InternalError extends Error {
  public constructor(message?: string){
    super(message ? `internal: ${message}` : `internal`);
  }
}

class SymbolTable<T> {
  private parent?: SymbolTable<T>;
  private symbols: { [key: string]: T } = {};

  public extend(): SymbolTable<T> {
    return new SymbolTable<T>(this);
  }

  public constructor(parent?: SymbolTable<T>){
    this.parent = parent;
  }

  /**
   * Gets the value associated with the given fully qualified identifier;
   * raises an error if it was not found.
   *
   * @param qualifiedIdentifier the fully qualified identifier to get.
   */
  public get(qualifiedIdentifier: string): T {
    const value = this.symbols[qualifiedIdentifier];
    if(value !== undefined){
      return value;
    }
    if(this.parent !== undefined){
      return this.parent.get(qualifiedIdentifier);
    }
    throw new Error(`invalid identifier ${qualifiedIdentifier}`);
  }

  /**
   * Sets the value associated with the given fully qualified identifier;
   * raises an error if it has already been set in *this* table, while
   * allowing shadowing *parent* tables.
   *
   * @param qualifiedIdentifier the fully qualified identifier to set.
   * @param value the value to set.
   */
  public set(qualifiedIdentifier: string, value: T): void {
    if(this.symbols[qualifiedIdentifier] !== undefined){
      throw new InternalError(`identifier redefinition ${qualifiedIdentifier}: ${this.symbols[qualifiedIdentifier]}`);
    }
    this.symbols[qualifiedIdentifier] = value;
  }

  /**
   * Determines whether this table contains the fully qualified identifier.
   *
   * @param qualifiedIdentifier the fully qualified identifier to check the presence of.
   */
  public has(qualifiedIdentifier: string): boolean {
    const value = this.symbols[qualifiedIdentifier];
    if(value !== undefined){
      return true;
    }
    if(this.parent !== undefined){
      return this.parent.has(qualifiedIdentifier);
    }
    return false;
  }

  /**
   * Given a namespace and a bare identifier, returns the possible locations
   * to search for the bare identifier.
   *
   * For example, if the current namespace is `global::foo::bar`, there's a
   * single `using` in the current namespace for `global::bleck`, and
   * we are looking up the bare identifier `baz`, we generate the following
   * lookups:
   *
   *    baz -- for locals / parameters.
   *
   *    global::foo::bar::baz -- search in the current namespace.
   *    global::foo::baz -- search in the containing namespace.
   *    global::baz -- search in the next containing namespace.
   *
   *    global::bleck::baz -- searching using.
   *
   * Once we've reached `global`, the top-level namespace, we are done.
   *
   * @param namespace the namespace in which the identifier is found
   * @param identifier the bare identifier to generate lookups for
   */
  private lookups(identifier: string, namespace: string, usings: string[]): string[] {
    if(!namespace){
      return [ identifier ];
    }

    // Cascading lookup.
    const lookups: string[] = [];
    const parts = namespace.split('::');
    parts.forEach((part, i) => {
      const lookup = parts.slice(0, i + 1);
      lookup.push(identifier);
      lookups.push(lookup.join('::'));
    });
    lookups.reverse();

    // Base identifier first.
    lookups.unshift(identifier);

    // Usings last.
    lookups.push(...usings.map((using) => {
      return [using, identifier].join('::');
    }));

    return lookups;
  }

  /**
   * Given a namespace and a bare identifier, looks up the bare identifier
   * respecting the lookup order (described in `lookups`, above). Returns
   * the value of the identifier if it is found, along with its fully qualified
   * name, or `undefined`.
   *
   * @param identifier
   * @param namespace
   * @param usings
   */
  public lookup(identifier: string, namespace: string, usings: string[]): { qualifiedIdentifier: string, value: T } | undefined {
    let lookup = this.lookups(identifier, namespace, usings).find((lookup) => {
      return this.has(lookup);
    });

    if(lookup !== undefined){
      return {
        qualifiedIdentifier: lookup,
        value: this.get(lookup),
      };
    }

    return;
  }
}

function indent(s: string, indent: number = 1): string {
  const indentation = new Array(indent).fill('  ').join('');
  return s.replace(/\n/g, '\n' + indentation);
}

function duplicates<T>(array: readonly T[]): T[] {
  const duplicates: T[] = [];
  array.forEach((s, index) => {
    if(array.indexOf(s) !== index){
      duplicates.push(s);
    }
  });
  return duplicates;
}

function unique<T>(array: T[]): T[] {
  const uniques: T[] = [];
  array.forEach((s, index) => {
    if(array.indexOf(s) === index){
      uniques.push(s);
    }
  });
  return uniques;
}

function logger(name: string): debug.Debugger {
  return debug(name);
}

async function readFiles(filenames: string[]): Promise<string[]> {
  return await Promise.all(filenames.map((filename) => fs.promises.readFile(filename, 'utf-8')));
}

class HasTags {
  protected tags: string[] = [];

  /**
   * Tags this type with the given tags.
   *
   * @param tags the tags to tag this type with.
   */
  public tag(tags: readonly string[] = []): this {
    this.tags.push(...tags);
    this.tags = unique(this.tags);
    return this;
  }

  /**
   * Checks if this type is tagged with the given tag.
   *
   * @param tag the tag to check.
   */
  public tagged(tag: string): boolean {
    return this.tags.indexOf(tag) !== -1;
  }

  /**
   * Prepends the given method with this object's tags.
   *
   * @param message the message to prepend with this object's tags.
   */
  public withTags(message: string): string {
    return this.tags.length ?
      `${this.tags.join(' ')} ${message}` :
      message;
  }
}

class Location {
  public constructor(private filename: string, private line: number, private column: number, private text: string){}

  public toString(){
    const parts = this.text.split('\n');
    const text = parts.length > 1 ? `${parts[0]}...` : this.text;
    return `${this.filename}(${this.line})[${this.column}]: ${text}`;
  }
}

interface IParseOptions {
  filename?: string;
  [key: string]: any;
}

interface IFilePosition {
  line: number;
  column: number;
}

interface IFileRange {
  start: IFilePosition;
}


class Syntax extends HasTags {
  protected location?: Location;

  public at(location?: Location): this;
  public at(range: IFileRange, text: string, options?: IParseOptions): this;
  public at(locationOrRange?: Location | IFileRange, text?: string, options?: IParseOptions): this {
    if(locationOrRange === undefined){
      this.location = undefined;
    }
    else if(locationOrRange instanceof Location){
      this.location = locationOrRange;
    }
    else {
      this.location = new Location(options?.filename || 'stdin', locationOrRange.start.line, locationOrRange.start.column, text!);
    }
    return this;
  }

  public error(messages: Messages, message: string): void {
    messages.error(message, this.location);
  }

  public warning(messages: Messages, message: string): void {
    messages.warning(message, this.location);
  }

  public lint(messages: Messages, message: string): void {
    // Nothin' for now.
  }

  public withLocation(s: string){
    if(!this.location){
      return s;
    }
    return `${this.location}: ${s}`;
  }
}


type MessageType = 'error' | 'warning';

class Message {
  public readonly type: MessageType;
  public readonly location?: Location;
  public readonly text: string;

  public constructor(type: MessageType, text: string, location?: Location){
    this.type = type;
    this.text = text;
    this.location = location;
  }

  public toString(){
    if(this.location !== undefined){
      return `${this.type}: ${this.location}: ${this.text}`;
    }
    return `${this.type}: ${this.text}`;
  }
}

class Messages {
  protected messages: Message[] = [];

  public error(message: string, location?: Location){
    this.messages.push(new Message('error', message, location));
  }

  public warning(message: string, location?: Location){
    this.messages.push(new Message('warning', message, location));
  }

  public get errors(): Message[] {
    return this.messages.filter((message) => message.type === 'error');
  }

  public get warnings(): Message[] {
    return this.messages.filter((message) => message.type === 'warning');
  }

  public toString(){
    return this.messages.join('\n');
  }

  public get length(): number {
    return this.messages.length;
  }
}

class ResolvablePromise<T> {
  private resolver!: (result: T) => void;
  private rejecter!: (e: any) => void;
  public readonly promise: Promise<T>;

  public constructor(){
    this.promise = new Promise((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  public resolve(result: T){
    this.resolver(result);
  }

  public reject(e: any){
    this.rejecter(e);
  }
}

function release(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve);
  });
}

/**
 * Parse a file with the given parser; attaches filename information to any thrown `SyntaxError`.
 *
 * @param parser a PEGjs parse function.
 * @param text the text to parse.
 * @param filename the filename of the source of the text.
 */
function parseFile<T>(parser: (text: string, options: IParseOptions) => T, text: string, filename: string = 'stdin', options?: IParseOptions): T {
  options = options || {};
  options.filename = filename;

  try {
    return parser(text, options);
  }
  catch(e){
    if(e.name === 'SyntaxError'){
      e.location.filename = filename;
    }
    throw e;
  }
}

function stringToCodePoints(s: string): number[] {
  return Array.from(s).map((s) => s.codePointAt(0) || 0);
}

function codePointsToString(codePoints: number[]) {
  return codePoints.map((c) => String.fromCodePoint(c)).join('');
}

function range(i: number, j: number): number[] {
  const l = [];
  for(let x = i; x < j; x++){
    l.push(x);
  }
  return l;
}

type Constructor<T> = Function & { prototype: T }
function writeOnce<K, F extends Constructor<K>>(cls: F, key: string, allowUndefined: boolean = false){
  const backingKey = `.${key}`;
  Object.defineProperty(cls.prototype, key, {
    get: function(){
      const value = this[backingKey];
      if(!allowUndefined && value === undefined){
        throw new InternalError(`write-once property ${key} of ${this.constructor.name} not set`);
      }
      return value;
    },
    set: function(value){
      const previousValue = this[backingKey];
      if(this[backingKey] !== undefined && value !== previousValue){
        throw new InternalError(`write-once property ${key} of ${this} already set to ${previousValue}, cannot set to ${value}`);
      }
      this[backingKey] = value;
    },
    enumerable: true,
  });
}

export {
  InternalError,
  indent,
  duplicates, unique,
  SymbolTable,
  logger,
  readFiles,
  parseFile,
  IParseOptions, IFileRange,
  Syntax,
  Messages,
  ResolvablePromise,
  release,
  stringToCodePoints,
  codePointsToString,
  range,
  writeOnce,
  Location,
}
