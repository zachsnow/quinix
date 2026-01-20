///////////////////////////////////////////////////////////////////////
// Types.
///////////////////////////////////////////////////////////////////////
Type
    = tags:TagList? type:PrefixType { return type.tag(tags); }

PrimaryType
    = StructType
    / FunctionType
    / b:ByteToken { return new BuiltinType(b).at(location(), text(), options); }
    / b:VoidToken { return new BuiltinType(b).at(location(), text(), options); }
    / id:QualifiedIdentifier { return new IdentifierType(id).at(location(), text(), options); }
    / "(" _ t:Type _ ")" { return t; }

PostfixType
    = t:PrimaryType _ "<" _ ts:TypeList _ ">" {
        return new TemplateInstantiationType(t, ts).at(location(), text(), options);
    }
    / t:PrimaryType tail:(PostfixTypeSuffix*) {
        return SuffixType.build(t, tail).at(location(), text(), options);
    }

PostfixTypeSuffix
    = _ "." _ id:Identifier {
        return { identifier: id, range: location(), text: text(), options };
    }
    / _ "[" _ "*" _ "]" {
        return { size: 'runtime', range: location(), text: text(), options };
    }
    / _ "[" _ i:IntLiteral? _ "]" {
        return { size: i !== null ? i : undefined, range: location(), text: text(), options };
    }

// ElementType is a type without trailing array/slice brackets.
// Used in `new T[n]` where T is the element type and n is the count.
ElementType
    = tags:TagList? type:ElementPrefixType { return type.tag(tags); }

ElementPostfixType
    = t:PrimaryType _ "<" _ ts:TypeList _ ">" {
        return new TemplateInstantiationType(t, ts).at(location(), text(), options);
    }
    / t:PrimaryType tail:(ElementPostfixTypeSuffix*) {
        return SuffixType.build(t, tail).at(location(), text(), options);
    }

ElementPostfixTypeSuffix
    = _ "." _ id:Identifier {
        return { identifier: id, range: location(), text: text(), options };
    }

ElementPrefixType
    = "*" _ t:ElementPrefixType { return new PointerType(t).at(location(), text(), options); }
    / ElementPostfixType

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
    = "(" _ ts:TypeList? _ ")" _ "=>" _ t:Type { return new FunctionType(ts || [], t).at(location(), text(), options); }

TypeList
    = t:Type ts:(_ "," _ Type)* (_ ",")? { return [t, ...ts.map((t: any) => t[3])]; }

TypeVariableList
    = "<" _ ids:IdentifierList _ ">" { return ids; }
