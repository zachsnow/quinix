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

FloatLiteral
  = "-Inf" { return floatToInt(-Infinity); }
  / "Inf" { return floatToInt(Infinity); }
  / "NaN" { return floatToInt(NaN); }
  / sign:"-"? whole:[0-9]+ "." frac:[0-9]+ exp:Exponent? "f" { const f = parseFloat((sign || '') + whole.join('') + '.' + frac.join('') + (exp || '')); if (!Number.isFinite(f)) { error('float literal out of range; use Inf or -Inf'); } return floatToInt(f); }
  / sign:"-"? whole:[0-9]+ exp:Exponent "f" { const f = parseFloat((sign || '') + whole.join('') + (exp || '')); if (!Number.isFinite(f)) { error('float literal out of range; use Inf or -Inf'); } return floatToInt(f); }

Exponent
  = [eE] sign:[+-]? digits:[0-9]+ { return 'e' + (sign || '') + digits.join(''); }

CharLiteral
  = "'" character:SingleQuoteChar "'" { return character; }

StringLiteral
  = "\"" characters:DoubleQuoteChar* "\"" { return characters.join(''); }

BoolLiteral
  = "true" { return true; }
  / "false" { return false; }

SingleQuoteChar
  = EscapedChar
  / [^\\\n']

DoubleQuoteChar
  = EscapedChar
  / [^\\\n"]

EscapedChar
  = "\\\\" { return "\\"; }
  / "\\'" { return "'"; }
  / "\\\"" { return "\""; }
  / "\\n" { return "\n"; }
  / "\\t" { return "\t"; }
  / "\\r" { return "\r"; }
  / "\\0" { return "\0"; }
  / "\\x" d1:[0-9a-fA-F] d2:[0-9a-fA-F] { return String.fromCharCode(parseInt(d1 + d2, 16)); }

_ "commented whitespace"
  = Whitespace (Comment Whitespace)* { return; }

Comment
  = "//" [^\n]* "\n"

Whitespace
  = [ \t\n]* { return; }

Tokens
  = LenToken / CapacityToken
  / NullToken / VoidToken / ByteToken / IntToken / FloatToken
  / SizeofToken / DefaultToken
  / NewToken / DeleteToken
  / UnsafeToken
  / IfToken / ElseToken
  / WhileToken / ForToken
  / VarToken
  / ReturnToken / BreakToken / ContinueToken
  / NamespaceToken / UsingToken
  / GlobalToken / TypeToken / FunctionToken

LenToken = tok:"len" !Identifier { return tok; }
CapacityToken = tok:"cap" !Identifier { return tok; }
NullToken = tok:"null" !Identifier { return tok; }
ByteToken = tok:"byte" !Identifier { return tok; }
IntToken = tok:"int" !Identifier { return tok; }
FloatToken = tok:"float" !Identifier { return tok; }
VoidToken = tok:"void" !Identifier { return tok; }
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
ContinueToken = tok:"continue" !Identifier { return tok; }
DeleteToken = tok:"delete" !Identifier { return tok; }
NamespaceToken = tok:"namespace" !Identifier { return tok; }
UsingToken = tok:"using" !Identifier { return tok; }
GlobalToken = tok:"global" !Identifier { return tok; }
TypeToken = tok:"type" !Identifier { return tok; }
FunctionToken = tok:"function" !Identifier { return tok; }

// Unused tokens.
DefaultToken = tok:"default" !Identifier { return tok; }
