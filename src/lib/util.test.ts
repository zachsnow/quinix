import { ResolvablePromise } from './util';

describe('Utilities', () => {
  describe('ResolvablePromise', () => {
    test('resolve', () => {
      expect.assertions(1);

      const resolvable = new ResolvablePromise<number>();
      const e = expect(resolvable.promise).resolves.toBe(10);
      resolvable.resolve(10);

      return e;
    });
  });
});
