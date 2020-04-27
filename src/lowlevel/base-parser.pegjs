///////////////////////////////////////////////////////////////////////
// Literals and base constructs.
///////////////////////////////////////////////////////////////////////
TagList
    = tags:("." [a-z]+ _)* { return tags.map((t: any) => '.' + t[1].join('')); }

QualifiedIdentifier
  = i:Identifier tail:("::" Identifier)* { return [i, ...tail.map((t: any) => t[1])].join('::'); }

Identifier
  = character:[a-zA-Z_] characters:[a-zA-Z_0-9]* { return character + characters.join(''); }

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
