import { DataSourceInitializationError } from '@/errors';

describe('DataSourceInitializationError test suite', () => {
  test('can be constructed and is an Error', () => {
    const e = new DataSourceInitializationError('init failed');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('DataSourceInitializationError');
  });
});
