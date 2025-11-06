import { DataSourceNotRegisteredError } from '@/errors';

describe('DataSourceNotRegisteredError test suite', () => {
  test('can be constructed and is an Error', () => {
    const e = new DataSourceNotRegisteredError('namedDS');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('DataSourceNotRegisteredError');
  });

  test('can be constructed and has a default message when none provided', () => {
    const e = new DataSourceNotRegisteredError();
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain('DataSource "default" is not registered');
  });
});
