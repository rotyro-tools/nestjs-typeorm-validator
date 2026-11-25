import { toError } from '@/utils';

describe('toError test suite', () => {
  test('returns Error instances unchanged', () => {
    const error = new Error('boom');
    expect(toError(error)).toBe(error);
  });

  test('wraps other thrown values in an Error', () => {
    const error = toError(42);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('42');
  });
});
