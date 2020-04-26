import { Memory } from './base-types';

describe('Base types', () => {
  describe('Memory', () => {
    test('from string', () => {
      const string = 'Hi, \ud83c\udf55!';
      const memory = Memory.fromString(string);
      expect(memory.length).toBe(6);
      expect(memory[0]).toBe(72);
      expect(memory[4]).toBe(127829);
      expect(memory[5]).toBe(33);
    });
  });
});
