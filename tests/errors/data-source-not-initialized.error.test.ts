import { DataSourceNotInitializedError } from '@/errors';

describe('DataSourceNotInitializedError test suite', () => {
  test('explains how to register an initialized data source', () => {
    const e = new DataSourceNotInitializedError('main');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('DataSourceNotInitializedError');
    expect(e.message).toContain(
      'DataSource "main" is registered for validation but is not initialized',
    );
    expect(e.message).toContain('@InjectDataSource()');
    expect(e.message).toContain('{ autoInitialize: true }');
  });
});
