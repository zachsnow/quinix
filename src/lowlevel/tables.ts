import { SymbolTable } from '../lib/util';
import { Type, ArrayType, TypedStorage } from './types';

class TypeTable extends SymbolTable<Type> {
  private constructor(){
    super();
  }

  public static empty(): TypeTable {
    return new TypeTable();
  }

  public static default(): TypeTable {
    const typeTable = TypeTable.empty();
    typeTable.set('bool', Type.Byte);
    typeTable.set('string', new ArrayType(Type.Byte));
    return typeTable;
  }
}

class StorageTable extends SymbolTable<TypedStorage> {}

export {
  TypeTable,
  StorageTable,
}
