import { parse as _parse } from './statements-parser';
import { Statement, ReturnStatement, DeleteStatement, WhileStatement, ForStatement } from './statements';

const parse: (text: string) => Statement = _parse;

describe('Statements', () => {
  describe('Parsing', () => {
    test('return', () => {
      expect(parse('return ;')).toBeInstanceOf(ReturnStatement);
      expect(parse('return;')).toBeInstanceOf(ReturnStatement);
      expect(parse('return 0;')).toBeInstanceOf(ReturnStatement);
    });

    test('delete', () => {
      expect(parse('delete null;')).toBeInstanceOf(DeleteStatement);
      expect(parse('delete foo;')).toBeInstanceOf(DeleteStatement);
      expect(parse('delete another();')).toBeInstanceOf(DeleteStatement);
    });

    test('while', () => {
      expect(parse(`while(true){}`)).toBeInstanceOf(WhileStatement);
      expect(parse(`while(true){
        var x = foo;
        x = x + 1;
      }`)).toBeInstanceOf(WhileStatement);
    });

    test('for', () => {
      expect(parse(`for(var i = 0; i < 10; i = i + 1){
        var j = foo[i];
        j = j * 2;
      }`)).toBeInstanceOf(ForStatement);
    });
  });
});
