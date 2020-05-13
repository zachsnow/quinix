///////////////////////////////////////////////////////////////////////
// Literals and base constructs.
///////////////////////////////////////////////////////////////////////
TagList
    = tags:("." [a-z]+ _)* { return tags.map((t: any) => '.' + t[1].join('')); }

QualifiedIdentifier
  = i:Identifier tail:("::" Identifier)* { return [i, ...tail.map((t: any) => t[1])].join('::'); }

Identifier
  = !Tokens character:[a-zA-Z_] characters:[a-zA-Z_0-9]* { return character + characters.join(''); }
  / GlobalToken

IdentifierList
    = id:Identifier ids:(_ "," _ Identifier)* { return [id, ...ids.map((t: any) => t[3])];}

IntLiteral
  = "0x" digits:[0-9a-fA-F]+ { return parseInt(digits.join(''), 16); }
  / "0b" digits:[01]+ { return parseInt(digits.join(''), 2); }
  / digits:[0-9]+ { return parseInt(digits.join(''), 10); }

StringLiteral
  = "'" characters:Char* "'" { return characters.join(''); }

BoolLiteral
  = "true" { return true; }
  / "false" { return false; }

Char
  = "\\\\" { return "\\"; }
  / "\\'" { return "'"; }
  / "\\n" { return "\n"; }
  / [^\\\n']

_ "commented whitespace"
  = Whitespace (Comment Whitespace)* { return; }

Comment
  = "//" [^\n]* "\n"

Whitespace
  = [ \t\n]* { return; }

Tokens
  = LenToken / NullToken / SizeofToken
  / NewToken / DeleteToken
  / UnsafeToken
  / IfToken / ElseToken
  / WhileToken / ForToken
  / VarToken
  / ReturnToken / BreakToken
  / NamespaceToken / GlobalToken / TypeToken / FunctionToken

LenToken = tok:"len" !Identifier { return tok; }
CapacityToken = tok:"capacity" !Identifier { return tok; }
NullToken = tok:"null" !Identifier { return tok; }
SizeofToken = tok:"sizeof" !Identifier { return tok; }
NewToken = tok:"new" !Identifier { return tok; }
UnsafeToken = tok:"unsafe" !Identifier { return tok; }
IfToken = tok:"if" !Identifier { return tok; }
ElseToken = tok:"else" !Identifier { return tok; }
ForToken = tok:"for" !Identifier { return tok; }
WhileToken = tok:"while" !Identifier { return tok; }
VarToken = tok:"var" !Identifier { return tok; }
ReturnToken = tok:"return" !Identifier { return tok; }
BreakToken = tok:"break" !Identifier { return tok; }
DeleteToken = tok:"delete" !Identifier { return tok; }
NamespaceToken = tok:"namespace" !Identifier { return tok; }
GlobalToken = tok:"global" !Identifier { return tok; }
TypeToken = tok:"type" !Identifier { return tok; }
FunctionToken = tok:"function" !Identifier { return tok; }
