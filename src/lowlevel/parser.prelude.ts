import {
  LowLevelProgram, Declaration, TypeDeclaration, TemplateTypeDeclaration,
  GlobalDeclaration,
  TemplateFunctionDeclaration, FunctionDeclaration,
  UsingDeclaration, NamespaceDeclaration,
} from './lowlevel';
import {
  VarStatement,
  AssignmentStatement,
  BlockStatement, ExpressionStatement,
  IfStatement, WhileStatement, ForStatement,
  DeleteStatement,
  ReturnStatement, BreakStatement, ContinueStatement,
} from './statements';
import {
  Expression,
  CallExpression,
  UnaryExpression, BinaryExpression,
  SuffixExpression,
  ConditionalExpression,
  IntLiteralExpression, FloatLiteralExpression, CharLiteralExpression, StringLiteralExpression, BoolLiteralExpression,
  ArrayLiteralExpression, ArrayRepeatExpression, StructLiteralExpression,
  IdentifierExpression,
  CastExpression,
  NewExpression, NewArrayExpression,
  NullExpression, VoidExpression,
  SizeofExpression,
} from './expressions';

// Float conversion helper for parsing float literals
const floatBuffer = new ArrayBuffer(4);
const floatIntView = new Uint32Array(floatBuffer);
const floatFloatView = new Float32Array(floatBuffer);

function floatToInt(f: number): number {
  floatFloatView[0] = f;
  return floatIntView[0];
}

import {
  Type, TypedIdentifier, BuiltinType,  PointerType, StructType,
  FunctionType, IdentifierType, ArrayType, SliceType, DotType,
  TemplateType, TemplateInstantiationType, SuffixType
} from './types';
