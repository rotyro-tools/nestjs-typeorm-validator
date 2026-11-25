import {
  DataSourceInitializationError,
  DataSourceInvalidError,
  DataSourceNotInitializedError,
  DataSourceNotRegisteredError,
} from '@/errors';
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

  type DSStub = {
    isInitialized: boolean;
    initialize: jest.Mock<Promise<unknown>, []>;
    getRepository: jest.Mock<unknown, []>;
  };

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

  function makeUninitializedDataSource(delayMs = 0): DSStub {
    const ds = {
      isInitialized: false,
      getRepository: jest.fn<unknown, []>(),
    } as unknown as DSStub;
    ds.initialize = jest.fn<Promise<unknown>, []>().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            ds.isInitialized = true;
            resolve(ds);
          }, delayMs);
        }),
    );
    return ds;
  }

  test('register throws when instance is null/invalid', () => {
    expect(() =>
      registerDataSourceForValidation(null as unknown as DataSourceLike),
    ).toThrow(DataSourceInvalidError);
    expect(() =>
      registerDataSourceForValidation({} as unknown as DataSourceLike),
    ).toThrow(DataSourceInvalidError);
  });

  test('register throws when dataSourceName is not a string', () => {
    const ds = makeMockDataSource();
    expect(() =>
      registerDataSourceForValidation(ds, 123 as unknown as string),
    ).toThrow(DataSourceInvalidError);
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
    registerDataSourceForValidation(ds2, null);
    const got2 = await getDataSourceForValidation(null);
    expect(got2).toBe(ds2);
  });

  test('registering again under the same name replaces the previous registration', async () => {
    const first = makeMockDataSource({ isInitialized: true });
    const second = makeMockDataSource({ isInitialized: true });
    registerDataSourceForValidation(first, 'main');
    registerDataSourceForValidation(second, 'main');
    await expect(getDataSourceForValidation('main')).resolves.toBe(second);
  });

  test('get throws DataSourceNotInitializedError and never initializes by default', async () => {
    const ds = makeUninitializedDataSource();
    registerDataSourceForValidation(ds as unknown as DataSourceLike, 'main');

    await expect(getDataSourceForValidation('main')).rejects.toThrow(
      DataSourceNotInitializedError,
    );
    await expect(getDataSourceForValidation('main')).rejects.toThrow(
      /DataSource "main" is registered for validation but is not initialized/,
    );
    expect(ds.initialize).not.toHaveBeenCalled();
  });

  test('autoInitialize initializes the data source on first use', async () => {
    const ds = makeUninitializedDataSource();
    registerDataSourceForValidation(ds as unknown as DataSourceLike, 'auto', {
      autoInitialize: true,
    });

    await expect(getDataSourceForValidation('auto')).resolves.toBe(ds);
    expect(ds.initialize).toHaveBeenCalledTimes(1);

    await expect(getDataSourceForValidation('auto')).resolves.toBe(ds);
    expect(ds.initialize).toHaveBeenCalledTimes(1);
  });

  test('autoInitialize shares one initialization between concurrent calls', async () => {
    const ds = makeUninitializedDataSource(10);
    registerDataSourceForValidation(ds as unknown as DataSourceLike, 'auto', {
      autoInitialize: true,
    });

    const results = await Promise.all(
      Array.from({ length: 50 }, () => getDataSourceForValidation('auto')),
    );

    expect(ds.initialize).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result === (ds as unknown))).toBe(true);
  });

  test('autoInitialize initializes again after the data source was destroyed', async () => {
    const ds = makeUninitializedDataSource();
    registerDataSourceForValidation(ds as unknown as DataSourceLike, 'auto', {
      autoInitialize: true,
    });

    await getDataSourceForValidation('auto');
    ds.isInitialized = false;
    await getDataSourceForValidation('auto');

    expect(ds.initialize).toHaveBeenCalledTimes(2);
  });

  test('autoInitialize wraps initialize rejection and retries on the next call', async () => {
    const ds = {
      isInitialized: false,
      initialize: jest
        .fn()
        .mockRejectedValueOnce(new Error('init fail'))
        .mockImplementationOnce(() => {
          ds.isInitialized = true;
          return Promise.resolve(ds);
        }),
      getRepository: jest.fn(),
    };
    registerDataSourceForValidation(ds, 'rejectInit', { autoInitialize: true });

    const failure = getDataSourceForValidation('rejectInit');
    await expect(failure).rejects.toThrow(DataSourceInitializationError);
    await expect(failure).rejects.toThrow(
      'Failed to initialize DataSource "rejectInit" for validation: init fail',
    );

    await expect(getDataSourceForValidation('rejectInit')).resolves.toBe(ds);
    expect(ds.initialize).toHaveBeenCalledTimes(2);
  });

  test('autoInitialize wraps non-Error rejections', async () => {
    const ds = makeMockDataSource({
      isInitialized: false,
      initialize: jest.fn().mockRejectedValue('string failure'),
    });
    registerDataSourceForValidation(ds, 'rejectString', {
      autoInitialize: true,
    });

    await expect(getDataSourceForValidation('rejectString')).rejects.toThrow(
      'Failed to initialize DataSource "rejectString" for validation: string failure',
    );
  });

  test('autoInitialize accepts a data source initialized elsewhere while its own initialize failed', async () => {
    const ds = {
      isInitialized: false,
      initialize: jest.fn().mockImplementation(() => {
        ds.isInitialized = true;
        return Promise.reject(new Error('already connected'));
      }),
      getRepository: jest.fn(),
    };
    registerDataSourceForValidation(ds, 'race', {
      autoInitialize: true,
    });

    await expect(getDataSourceForValidation('race')).resolves.toBe(ds);
  });

  test('autoInitialize throws when initialize resolves but isInitialized remains false', async () => {
    const ds = makeMockDataSource({
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
    });
    registerDataSourceForValidation(ds, 'badInit', { autoInitialize: true });

    await expect(getDataSourceForValidation('badInit')).rejects.toThrow(
      DataSourceInitializationError,
    );
    await expect(getDataSourceForValidation('badInit')).rejects.toThrow(
      /badInit/,
    );
  });

  test('get throws when requested data source is not registered', async () => {
    await expect(getDataSourceForValidation('nope')).rejects.toThrow(
      DataSourceNotRegisteredError,
    );
    await expect(getDataSourceForValidation('nope')).rejects.toThrow(/nope/);
  });
});
