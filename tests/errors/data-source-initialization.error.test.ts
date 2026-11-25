import { DataSourceInitializationError } from '@/errors';

describe('DataSourceInitializationError test suite', () => {
  test('can be constructed and is an Error', () => {
    const e = new DataSourceInitializationError('main');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('DataSourceInitializationError');
    expect(e.message).toBe(
      'Failed to initialize DataSource "main" for validation',
    );
  });

  test('includes the cause message', () => {
    const cause = new Error('Too many connections');
    const e = new DataSourceInitializationError('main', cause);
    expect(e.message).toBe(
      'Failed to initialize DataSource "main" for validation: Too many connections',
    );
    expect(e.cause).toBe(cause);
  });
});
