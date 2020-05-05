Directives
  = ds:(_ CommentedDirective? _ Terminator)* _ d:CommentedDirective? {
    return new AssemblyProgram([
      ...ds.map((d: any) => d[1]).filter((d: any): d is Directive => !!d),
      ...d ? [d] : [],
    ]);
  }

Terminator
  = "\n" // End of line.

CommentedDirective
  = d:Directive _ Comment { return d; }
  / d:Directive { return d; }
  / Comment { return; }

Directive
  = constant:Constant
  / data:Data
  / instruction:Instruction { return new InstructionDirective(instruction).at(location(), text(), options); }
  / label:Label

Comment
  = ";" [^\n]* { return; }

Constant
  = "constant" _ r:DestinationRegister _ reference:Reference { return new ConstantDirective(r, new ReferenceConstant(reference)).at(location(), text(), options); }
  / "constant" _ r:DestinationRegister _ number:Number { return new ConstantDirective(r, new ImmediateConstant(number)).at(location(), text(), options); }

Data
  = "data" _ reference:Reference _ numbers:NumberList { return new DataDirective(reference, new ImmediatesData(numbers)).at(location(), text(), options); }
  / "data" _ reference:Reference _ string:String { return new DataDirective(reference, new TextData(string)).at(location(), text(), options); }
  / "data" _ reference:Reference _ id:Reference { return new DataDirective(reference, new ReferenceData(id)).at(location(), text(), options); }

Label
  = reference:Reference ":" { return new LabelDirective(reference).at(location(), text(), options); }

Instruction
  = _ operation:BinaryUpdateOperation _ dr:DestinationRegister _ sr0:SourceRegister _ sr1:SourceRegister _ { return Instruction.createOperation(operation, dr, sr0, sr1); }
  / _ operation:UnaryUpdateOperation _ dr:DestinationRegister _ sr0:SourceRegister _ { return Instruction.createOperation(operation, dr, sr0); }
  / _ operation:BinaryOperation _ sr0:SourceRegister _ sr1:SourceRegister _ { return Instruction.createOperation(operation, undefined, sr0, sr1); }
  / _ operation:UnaryOperation _ sr0:SourceRegister _ { return Instruction.createOperation(operation, undefined, sr0); }
  / _ operation:NullaryOperation _ { return Instruction.createOperation(operation); }

BinaryUpdateOperation
  = "add" { return Operation.ADD; }
  / "sub" { return Operation.SUB; }
  / "mul" { return Operation.MUL; }
  / "div" { return Operation.DIV; }
  / "mod" { return Operation.MOD; }
  / "and" { return Operation.AND; }
  / "or" { return Operation.OR; }
  / "eq" { return Operation.EQ; }
  / "neq" { return Operation.NEQ; }
  / "lt" { return Operation.LT; }
  / "gt" { return Operation.GT; }

UnaryUpdateOperation
  = "load" { return Operation.LOAD; }
  / "store" { return Operation.STORE; }
  / "mov" { return Operation.MOV; }
  / "not" { return Operation.NOT; }

BinaryOperation
  = "jz" { return Operation.JZ; }
  / "jnz" { return Operation.JNZ; }

UnaryOperation
  = "jmp" { return Operation.JMP; }
  / "int" { return Operation.INT; }

NullaryOperation
  = "halt" { return Operation.HALT; }
  / "wait" { return Operation.WAIT; }
  / "nop" { return Operation.NOP; }

SourceRegister
  = r:"ip" { return Register.parse(r); }
  / dr:DestinationRegister { return dr; }

DestinationRegister
  = "r" number:[0-9]+ { return Register.parse("r" + number.join('')); }

Reference
  = "@" id:QualifiedIdentifier { return new Reference(id); }
  / "@" id:QuotedIdentifier { return new Reference(id, true); }

QualifiedIdentifier
  = i:Identifier tail:("::" Identifier)* { return [i, ...tail.map((t: any) => t[1])].join('::'); }

Identifier
  = character:[a-zA-Z_] characters:[a-zA-Z_0-9\$]* { return character + characters.join(''); }

QuotedIdentifier
  = "`" characters:[^`\n]* "`" { return characters.join(''); }

Number
  = "0x" number:[0-9a-fA-F]+ { return parseInt(number.join(''), 16); }
  / "0b" digits:[01]+ { return parseInt(digits.join(''), 2); }
  / number:[0-9]+ { return parseInt(number.join(''), 10); }

NumberList
  = number:Number tail:(_ Number)* { return [ number, ...tail.map((t: any) => t[1]) ]; }

String
  = "'" characters:Char* "'" { return characters.join(''); }

Char
  = "\\\\" { return "\\"; }
  / "\\'" { return "'"; }
  / "\\n" { return "\n"; }
  / [^\\\n']


_ "whitespace"
  = [ \t]*
