import type { DataSourceLike } from '@/types';
import {
  clearDataSourcesForValidation,
  getDataSourceForValidation,
  registerDataSourceForValidation,
} from '@/utils';

describe('Data source utilities test suite', () => {
  beforeEach(() => {
    clearDataSourcesForValidation();
    jest.clearAllMocks();
  });

  function makeMockDataSource(
    overrides: Partial<DataSourceLike> = {},
  ): DataSourceLike {
    const ds = {
      isInitialized: overrides.isInitialized ?? true,
      initialize:
        overrides.initialize ??
        (jest.fn().mockResolvedValue(undefined) as unknown),
      getRepository: overrides.getRepository ?? (jest.fn() as unknown),
    };

    return ds as unknown as DataSourceLike;
  }

  test('register throws when instance is null/invalid', () => {
    expect(() =>
      registerDataSourceForValidation(null as unknown as DataSourceLike),
    ).toThrow(Error);
    expect(() =>
      registerDataSourceForValidation({} as unknown as DataSourceLike),
    ).toThrow(Error);
  });

  test('register throws when dataSourceName is not a string', () => {
    const ds = makeMockDataSource();
    expect(() =>
      registerDataSourceForValidation(ds, 123 as unknown as string),
    ).toThrow(Error);
  });

  test('register + get returns same instance when already initialized (default name)', async () => {
    const ds = makeMockDataSource({ isInitialized: true });
    registerDataSourceForValidation(ds);
    const got = await getDataSourceForValidation();
    expect(got).toBe(ds);
  });

  test('name normalization: trimmed name used', async () => {
    const ds = makeMockDataSource({ isInitialized: true });
    registerDataSourceForValidation(ds, '  mysource  ');
    const got = await getDataSourceForValidation('mysource');
    expect(got).toBe(ds);
  });

  test('null/undefined/empty name normalize to default', async () => {
    const ds = makeMockDataSource({ isInitialized: true });
    registerDataSourceForValidation(ds, '');
    const got1 = await getDataSourceForValidation();
    expect(got1).toBe(ds);

    const ds2 = makeMockDataSource({ isInitialized: true });
    registerDataSourceForValidation(ds2, undefined);
    const got2 = await getDataSourceForValidation(
      null as unknown as string | undefined,
    );
    expect(got2).toBe(ds2);
  });

  test('get auto-initializes when isInitialized=false and initialize sets the flag', async () => {
    type DSStub = {
      isInitialized: boolean;
      initialize: jest.Mock<Promise<unknown>, []>;
      getRepository: jest.Mock<unknown, []>;
    };

    const ds = {} as DSStub;
    ds.isInitialized = false;
    ds.initialize = jest.fn<Promise<unknown>, []>().mockImplementation(() => {
      ds.isInitialized = true;
      return Promise.resolve(ds);
    });
    ds.getRepository = jest.fn<unknown, []>();

    const dsTyped = ds as unknown as DataSourceLike;
    registerDataSourceForValidation(dsTyped, 'autoInit');
    const got = await getDataSourceForValidation('autoInit');
    expect(ds.initialize).toHaveBeenCalled();
    expect(got).toBe(dsTyped);
  });

  test('get throws when initialize resolves but isInitialized remains false', async () => {
    const ds = {
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn(),
    } as unknown as DataSourceLike;

    registerDataSourceForValidation(ds, 'badInit');
    await expect(getDataSourceForValidation('badInit')).rejects.toThrow(Error);
    await expect(getDataSourceForValidation('badInit')).rejects.toThrow(
      /badInit/,
    );
  });

  test('get propagates initialize rejection', async () => {
    const ds = {
      isInitialized: false,
      initialize: jest.fn().mockRejectedValue(new Error('init fail')),
      getRepository: jest.fn(),
    } as unknown as DataSourceLike;

    registerDataSourceForValidation(ds, 'rejectInit');
    await expect(getDataSourceForValidation('rejectInit')).rejects.toThrow(
      /init fail/,
    );
  });

  test('get throws when requested data source is not registered', async () => {
    await expect(getDataSourceForValidation('nope')).rejects.toThrow(Error);
    await expect(getDataSourceForValidation('nope')).rejects.toThrow(/nope/);
  });
});
