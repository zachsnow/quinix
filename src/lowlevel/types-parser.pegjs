///////////////////////////////////////////////////////////////////////
// Types.
///////////////////////////////////////////////////////////////////////
Type
    = tags:TagList? type:PrefixType { return type.tag(tags); }

PrimaryType
    = StructType
    / FunctionType
    / id:QualifiedIdentifier { return IdentifierType.build(id).at(location(), text(), options); }
    / "(" _ t:Type _ ")" { return t; }

PostfixType
    = t:PrimaryType tail:(_ "[" _ IntLiteral? _ "]")* {
        return ArrayType.build(t, tail.map((t: any) => t[3] || undefined)).at(location(), text(), options);
    }

PrefixType
    = "*" _ t:PrefixType { return new PointerType(t).at(location(), text(), options); }
    / PostfixType

StructType
    = "struct" _ "{" _ sml:MemberTypeList? _ "}" { return new StructType(sml).at(location(), text(), options); }

MemberTypeList
    = ti:TypedIdentifier _ ";" tis:(_ TypedIdentifier _ ";" _)* (_ ";")? { return [ti, ...tis.map((ti: any) => ti[1])]; }

TypedIdentifier
    = id:Identifier _ ":" _ t:Type { return new TypedIdentifier(id, t); }

FunctionType
    = "(" _ ts:TypeList? _ ")" _ "=>" _ t:Type { return new FunctionType([], ts || [], t).at(location(), text(), options); }

TypeList
    = t:Type ts:(_ "," _ Type)* (_ ",")? { return [t, ...ts.map((t: any) => t[3])]; }
