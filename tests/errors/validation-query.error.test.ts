import { ValidationQueryError } from '@/errors';

describe('ValidationQueryError test suite', () => {
  test('can be constructed and wraps original error', () => {
    const original = new Error('boom');
    const e = new ValidationQueryError('query failed', original, { a: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ValidationQueryError');
    expect(e.cause).toBe(original);
  });

  test('appends the database error message', () => {
    const e = new ValidationQueryError(
      'Failed to validate in Company.uuid',
      new Error('Too many connections'),
    );
    expect(e.message).toBe(
      'Failed to validate in Company.uuid: Too many connections',
    );
  });
});
