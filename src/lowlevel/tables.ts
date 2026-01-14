import { SymbolTable } from '@/lib/util';
import { Type, ArrayType, TypedStorage } from './types';

class TypeTable extends SymbolTable<Type> { }
class StorageTable extends SymbolTable<TypedStorage> { }

export {
  TypeTable,
  StorageTable,
}
