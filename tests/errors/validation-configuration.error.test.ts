import { ValidationConfigurationError } from '@/errors';

describe('ValidationConfigurationError test suite', () => {
  test('can be constructed and is an Error', () => {
    const meta = { foo: 'bar' };
    const e = new ValidationConfigurationError('bad config', meta);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ValidationConfigurationError');
  });
});
