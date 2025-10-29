import { ValidationQueryError } from '@/errors';

describe('ValidationQueryError test suite', () => {
  test('can be constructed and wraps original error', () => {
    const original = new Error('boom');
    const e = new ValidationQueryError('query failed', original, { a: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ValidationQueryError');
  });
});
