import { InternalError, logger, mixin, HasTags, HasLocation } from '../lib/util';
import {
  ConstantDirective, ReferenceConstant,
  InstructionDirective,
  LabelDirective,

  AssemblyProgram,
  ImmediateConstant,
} from '../assembly/assembly';
import { indent } from '../lib/util';
import { Type, TypedStorage, PointerType, ArrayType } from './types';
import { Expression, IntLiteralExpression } from './expressions';
import { Compiler, StorageCompiler, FunctionCompiler } from './compiler';
import { TypeChecker, KindChecker } from './typechecker';
import { Instruction, Operation } from '../vm/instructions';

const log = logger('lowlevel:statements');

///////////////////////////////////////////////////////////////////////
// Statements.
///////////////////////////////////////////////////////////////////////
abstract class Statement extends mixin(HasTags, HasLocation) {
  public abstract typecheck(context: TypeChecker): void;
  public abstract compile(compiler: Compiler): void;

  public static compile(s: Statement): AssemblyProgram {
    const compiler = new Compiler('statement');
    s.compile(compiler);
    return new AssemblyProgram(compiler.compile());
  }

  /**
   * Returns `true` if all paths through this statement reach
   * a `return`.
   */
  public returns(): boolean {
    return false;
  }
}
interface Statement extends HasTags, HasLocation {}


class BlockStatement extends Statement {
  private statements: Statement[] = [];

  public constructor(statements: Statement[]){
    super();
    this.statements = statements;
  }

  public typecheck(context: TypeChecker): void {
    // Use a nested symbol table so that identifiers created inside the block
    // don't leak outside of the block.
    const nestedContext = context.extend(undefined, context.symbolTable.extend());
    this.statements.forEach((statement) => {
      statement.typecheck(nestedContext);
    });
  }

  public compile(compiler: Compiler): void {
    // TODO: nested blocks mean that allocating a variable
    // gets a different name.
    this.statements.forEach((statement) => {
      statement.compile(compiler);
    });
  }

  public returns(): boolean {
    // If all paths through any statement in the block
    // return, then the block returns (and statements after
    // the returning statement area dead).
    //
    // TODO: warn on dead code.
    return this.statements.some((statement) => {
      return statement.returns();
    });
  }

  public toString(): string {
    return '{' + indent('\n' + this.statements.join('\n')) + '\n}';
  }
}

class VarStatement extends Statement {
  private identifier: string;
  private type?: Type;
  private concreteType?: Type;
  private expression?: Expression;

  public constructor(identifier: string, type?: Type, expression?: Expression){
    super();
    this.identifier = identifier;
    this.type = type;
    this.expression = expression;
  }

  public typecheck(context: TypeChecker): void {
    if(!this.type && !this.expression){
      this.error(context, `expected type or expression`);
      return;
    }

    // Check that the type of the variable we are defining is valid.
    if(this.type){
      this.type.kindcheck(context, new KindChecker());
    }

    // Check that the expression has the same type as the variable we are defining.
    // We allow conversion for easier use of literals.
    if(this.expression){
      const actualType = this.expression.typecheck(context, this.type);
      if(this.type && !this.type.isConvertibleTo(actualType, context)){
        this.error(context, `expected ${this.type}, actual ${actualType}`);
      }
      else if(!this.type) {
        this.type = actualType;
      }
    }

    // At this point we should either have a defined type or an inferred type;
    // satisfy the tye checker.
    if(!this.type){
      throw new InternalError();
    }

    // Update the symbol table so subsequent statements in this block
    // (and in nested blocks) can use it.
    context.symbolTable.set(this.identifier, new TypedStorage(this.type, 'local'));

    // Save the concrete type so we can determine how much storage to allocate;
    // since we don't always have an expression we have to save this manuall.
    this.concreteType = this.type.resolve(context);
  }

  public compile(compiler: Compiler): void {
    // We can only compile if we've completed typechecking.
    if(this.concreteType === undefined){
      throw new InternalError(`${this} has not been typechecked`);
    }

    // We can only compile a return statement when we are compiling a function.
    if(!(compiler instanceof StorageCompiler)){
      throw new InternalError(`unable to compile ${this} outside of a function`);
    }

    // Create storage for this variable.
    compiler.allocateStorage(this.identifier, this.concreteType.size);

    // Local declarations without initializers zero out the space.
    if(!this.expression){
      const vr = compiler.allocateRegister();
      const r = compiler.allocateRegister();
      compiler.emitIdentifier(this.identifier, 'local', vr, false);
      compiler.emit([
        new ConstantDirective(r, new ImmediateConstant(0)),
      ]);
      compiler.emitStaticStore(vr, r, this.concreteType.size, 'zero out');

      if(this.concreteType instanceof ArrayType && this.concreteType.length !== undefined){
        compiler.emit([
          new ConstantDirective(r, new ImmediateConstant(this.concreteType.length)).comment('array size'),
        ]);
        compiler.emitStaticStore(vr, r, 2, 'initialize array capacity and size');
      }
      compiler.deallocateRegister(vr);
      compiler.deallocateRegister(r);
      return;
    }

    const er = this.expression.compile(compiler);

    // Get the address of the local.
    const r = compiler.allocateRegister();
    compiler.emitIdentifier(this.identifier, 'local', r, false);

    // Store to that address.
    if(this.concreteType.isIntegral()){
      compiler.emitStaticStore(r, er, 1, `${this}`);
    }
    else {
      compiler.emitStaticCopy(r, er, this.expression.concreteType.size, `${this}`);
    }

    compiler.deallocateRegister(er);
    compiler.deallocateRegister(r);
  }

  public toString(){
    if(this.expression){
      return `var ${this.identifier}: ${this.type} = ${this.expression};`;
    }
    return `var ${this.identifier}: ${this.type};`
  }
}

class AssignmentStatement extends Statement {
  private assignable: Expression;
  private expression: Expression;

  public constructor(assignable: Expression, expression: Expression){
    super();
    this.assignable = assignable;
    this.expression = expression;
  }

  public typecheck(context: TypeChecker): void {
    // The assignable should have the same type as the expression being assigned.
    const expectedType = this.assignable.typecheck(context);
    const actualType = this.expression.typecheck(context, expectedType);

    // Allow conversion.
    if(!expectedType.isConvertibleTo(actualType, context)){
      this.error(context, `expected ${expectedType}, actual ${actualType}`);
    }

    // Verify that the left side is indeed assignable.
    if(!this.assignable.isAssignable){
      this.error(context, `expected ${this.assignable} to be assignable`);
    }

    // Verify that the left hand side hasn't been tagged constant.
    if(expectedType.tagged('.constant')){
      this.error(context, `expected non-constant assignable, actual ${expectedType}`);
    }
  }

  public compile(compiler: Compiler): void {
    const ar = this.assignable.compile(compiler, true);
    const er = this.expression.compile(compiler);

    if(this.assignable.concreteType.isIntegral()){
      compiler.emitStaticStore(ar, er, 1, `${this}`);
    }
    else {
      compiler.emitStaticCopy(ar, er, this.assignable.concreteType.size, `${this}`);
    }

    compiler.deallocateRegister(ar);
    compiler.deallocateRegister(er);
  }

  public toString(){
    return `${this.assignable} = ${this.expression};`;
  }
}

class ExpressionStatement extends Statement {
  private expression: Expression;

  public constructor(expression: Expression){
    super();
    this.expression = expression;
  }

  public typecheck(context: TypeChecker): void {
    const type = this.expression.typecheck(context);

    if(!type.isConvertibleTo(Type.Void, context)){
      log(`expected ${Type.Void}, actual ${type}`);
    }
  }

  public compile(compiler: Compiler): void {
    const r = this.expression.compile(compiler);
    compiler.deallocateRegister(r);
  }

  public toString(){
    return `${this.expression};`;
  }
}

class IfStatement extends Statement {
  private condition: Expression;
  private ifBranch: BlockStatement;
  private elseBranch?: BlockStatement;

  public constructor(condition: Expression, ifBranch: BlockStatement, elseBranch?: BlockStatement){
    super();

    this.condition = condition;
    this.ifBranch = ifBranch;
    this.elseBranch = elseBranch;
  }

  public typecheck(context: TypeChecker): void {
    const conditionType = this.condition.typecheck(context);

    // Integer conditions -- numbers, pointers, function pointers. We exclude
    // arrays even though they are integral because they are always truthy.
    if(!conditionType.isIntegral(context)){
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    this.ifBranch.typecheck(context);
    if(this.elseBranch){
      this.elseBranch.typecheck(context);
    }
  }

  public compile(compiler: Compiler): void {
    // Evaluate condition.
    const cr = this.condition.compile(compiler);

    const elseRef = compiler.generateReference('else');
    const endRef = compiler.generateReference('if_end');
    const r = compiler.allocateRegister();

    // If the condition is false, jump to the else branch.
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(0)),
      new InstructionDirective(Instruction.createOperation(Operation.NEQ, cr, cr, r)),
      new ConstantDirective(r, new ReferenceConstant(elseRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, cr, r))
    ]);

    // Otherwise, fall through to the if branch.
    this.ifBranch.compile(compiler);

    // Jump to the end.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    // Else branch.
    compiler.emit([
      new LabelDirective(elseRef),
    ]);
    this.elseBranch?.compile(compiler);

    // End.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(r);
  }

  public returns(): boolean {
    // Only if/else expressions in which *both* branches always return, always return.
    return this.ifBranch.returns() && (!!this.elseBranch && this.elseBranch.returns());
  }

  public toString(){
    if(!this.elseBranch){
      return `if(${this.condition}) ${this.ifBranch}`;
    }
    return `if(${this.condition}) ${this.ifBranch} else ${this.elseBranch}`;
  }

  public static build(condition: Expression, ifBlock: BlockStatement, elseIfTail: [Expression, BlockStatement][], elseBlock?: BlockStatement){
    const elseTail = elseIfTail.reduce((elseBlock, [ condition, ifBlock ]) => {
      return new BlockStatement([ new IfStatement(condition, ifBlock, elseBlock) ]);
    }, elseBlock);

    return new IfStatement(condition, ifBlock, elseTail);
  }
}

class ForStatement extends Statement {
  private initializer: Statement;
  private condition: Expression;
  private update: Statement;
  private block: BlockStatement;

  public constructor(initializer: Statement, condition: Expression, update: Statement, block:BlockStatement){
    super();
    this.initializer = initializer;
    this.condition = condition;
    this.update = update;
    this.block = block;
  }

  public typecheck(context: TypeChecker): void {
    this.initializer.typecheck(context);

    const conditionType = this.condition.typecheck(context);

    // Integer conditions and pointer conditions are allowed.
    if(!conditionType.isIntegral(context)){
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    this.update.typecheck(context);

    this.block.typecheck(context.loop());

    return;
  }

  public compile(compiler: Compiler){
    // Initializer.
    this.initializer.compile(compiler);

    const topRef = compiler.generateReference('for');
    const endRef = compiler.generateReference('for_end');
    const r = compiler.allocateRegister();

    compiler.emit([
      new LabelDirective(topRef),
    ]);

    const cr = this.condition.compile(compiler);

    // If the condition is false, jump to the end.
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(0)),
      new InstructionDirective(Instruction.createOperation(Operation.NEQ, cr, cr, r)),
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, cr, r))
    ]);

    // For loop body.
    compiler.loop(endRef, () => {
      this.block.compile(compiler);
    });

    this.update.compile(compiler);

    // Return to the top.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(topRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    // End.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(r);
  }

  public toString(){
    return `for(${this.initializer} ${this.condition}; ${this.update}) ${this.block}`;
  }
}

class WhileStatement extends Statement {
  private condition: Expression;
  private block: BlockStatement;

  public constructor(condition: Expression, block: BlockStatement){
    super();

    this.condition = condition;
    this.block = block;
  }

  public typecheck(context: TypeChecker): void {
    const conditionType = this.condition.typecheck(context);

    // Integer conditions and pointer conditions are allowed.
    if(!conditionType.isIntegral(context)){
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    this.block.typecheck(context.loop());
  }

  public compile(compiler: Compiler): void {
    const topRef = compiler.generateReference('while');
    const endRef = compiler.generateReference('while_end');
    const r = compiler.allocateRegister();

    compiler.emit([
      new LabelDirective(topRef),
    ]);

    const cr = this.condition.compile(compiler);

    // If the condition is false, jump to the end.
    compiler.emit([
      new ConstantDirective(r, new ImmediateConstant(0)),
      new InstructionDirective(Instruction.createOperation(Operation.NEQ, cr, cr, r)),
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JNZ, undefined, cr, r))
    ]);

    // While loop body.
    compiler.loop(endRef, () => {
      this.block.compile(compiler);
    });

    // Return to the top.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(topRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    // End.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(r);
  }

  public toString(){
    return `while(${this.condition}) ${this.block}`;
  }
}

/**
 * A return statement of the form `return;` or `return expression;`.
 */
class ReturnStatement extends Statement {
  private expression?: Expression;

  public constructor(expression?: Expression){
    super();
    this.expression = expression;
  }

  public typecheck(context: TypeChecker): void {
    const returnType = this.expression ? this.expression.typecheck(context) : Type.Void;
    const storage = context.symbolTable.get('return');

    if(!returnType.isEqualTo(storage.type, context)){
      this.error(context, `expected ${storage.type}, actual ${returnType}`);
    }
  }

  public compile(compiler: Compiler): void {
    // We can only compile a return statement in the context of a function.
    if(!(compiler instanceof FunctionCompiler)){
      throw new InternalError(`unable to compile return outside of a function`);
    }

    // If we have an expression, evaluate it, otherwise just evaluate 0. Then move the evaluation
    // to the return register.
    const expression = this.expression || new IntLiteralExpression(0);
    const r = expression.compile(compiler);
    compiler.emitReturn(r);
    compiler.deallocateRegister(r);
  }

  public returns(): boolean {
    return true;
  }

  public toString(){
    if(this.expression){
      return `return ${this.expression};`;
    }
    return `return;`;
  }
}

class BreakStatement extends Statement {
  public constructor(){
    super();
  }

  public typecheck(context: TypeChecker): void {
    if(!context.inLoop){
      this.error(context, `break outside of for or while`);
    }
  }

  public compile(compiler: Compiler): void {
    if(!compiler.breakReference){
      throw new InternalError(`unable to compile break outside of a for or while statement`);
    }

    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(compiler.breakReference)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);
    compiler.deallocateRegister(r);
  }

  public returns(): boolean {
    return false;
  }

  public toString(){
    return `break;`;
  }
}

/**
 * A delete statement of the form `delete expression;`.
 */
class DeleteStatement extends Statement {
  private expression: Expression;

  public constructor(expression: Expression){
    super();
    this.expression = expression;
  }

  public typecheck(context: TypeChecker): void {
    const type = this.expression.typecheck(context);
    const cType = type.resolve(context);

    if(!(cType instanceof PointerType) && !(cType instanceof ArrayType)){
      this.error(context, `expected array or pointer type, actual ${type}`);
    }
  }

  public compile(compiler: Compiler): void {
    const dr = this.expression.compile(compiler);
    compiler.emitDelete(dr);
  }

  public returns(): boolean {
    return false;
  }

  public toString(){
    return `delete ${this.expression};`;
  }
}

export {
  Statement,
  BlockStatement,
  ExpressionStatement,
  VarStatement,
  DeleteStatement,
  IfStatement,
  ForStatement, WhileStatement,
  AssignmentStatement,
  ReturnStatement,
  BreakStatement,
};
