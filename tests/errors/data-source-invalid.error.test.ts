import { DataSourceInvalidError } from '@/errors';

describe('DataSourceInvalidError test suite', () => {
  test('can be constructed and is an Error', () => {
    const e = new DataSourceInvalidError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('DataSourceInvalidError');
  });
});
