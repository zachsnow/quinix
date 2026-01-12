import { ResolvablePromise } from './util';

describe('Utilities', () => {
  describe('ResolvablePromise', () => {
    test('resolve', async () => {
      const resolvable = new ResolvablePromise<number>();
      setTimeout(() => resolvable.resolve(10), 1);
      const result = await resolvable.promise;
      expect(result).toBe(10);
    });
  });
});
