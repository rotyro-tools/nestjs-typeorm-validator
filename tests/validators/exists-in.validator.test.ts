import { ValidationConfigurationError, ValidationQueryError } from '@/errors';
import type { BaseValidatorArguments } from '@/types';
import {
  clearDataSourcesForValidation,
  registerDataSourceForValidation,
} from '@/utils';
import { ExistsInValidator } from '@/validators';

jest.mock('typeorm', () => ({
  getRepository: jest.fn(),
}));

describe('ExistsInValidator test suite', () => {
  class DummyEntity {
    id?: number;
    name?: string;
  }

  type QBResult = Record<string, unknown> | undefined;

  type QueryBuilder = {
    select: (s?: string) => QueryBuilder;
    where: (q: string, p?: Record<string, unknown>) => QueryBuilder;
    take: (n: number) => QueryBuilder;
    getRawOne: () => Promise<QBResult>;
  };

  let getRawOneMock: jest.MockedFunction<() => Promise<QBResult>>;
  let builder: {
    select: jest.MockedFunction<(s?: string) => QueryBuilder>;
    where: jest.MockedFunction<
      (q: string, p?: Record<string, unknown>) => QueryBuilder
    >;
    take: jest.MockedFunction<(n: number) => QueryBuilder>;
    getRawOne: jest.MockedFunction<() => Promise<QBResult>>;
  };
  let repo: {
    createQueryBuilder: jest.MockedFunction<(alias?: string) => QueryBuilder>;
  };
  let mockDataSource: Parameters<typeof registerDataSourceForValidation>[0];

  beforeEach(() => {
    getRawOneMock = jest.fn() as jest.MockedFunction<() => Promise<QBResult>>;
    builder = {
      select: jest.fn().mockReturnThis() as jest.MockedFunction<
        (s?: string) => QueryBuilder
      >,
      where: jest.fn().mockReturnThis() as jest.MockedFunction<
        (q: string, p?: Record<string, unknown>) => QueryBuilder
      >,
      take: jest.fn().mockReturnThis() as jest.MockedFunction<
        (n: number) => QueryBuilder
      >,
      getRawOne: getRawOneMock,
    };

    repo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(builder) as jest.MockedFunction<
        (alias?: string) => QueryBuilder
      >,
    };

    mockDataSource = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };

    registerDataSourceForValidation(mockDataSource);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns true when queryBuilder.getRawOne finds a row', async () => {
    const found = { '1': 1 };
    getRawOneMock.mockResolvedValue(found);

    const validator = new ExistsInValidator();

    const args: BaseValidatorArguments = {
      value: 'match',
      targetName: 'name',
      object: {},
      property: 'name',
      constraints: [DummyEntity, 'name', undefined],
    };

    await expect(validator.validate('match', args)).resolves.toBe(true);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');
    expect(builder.where).toHaveBeenCalledWith(
      `entityOrTableName.name = :value`,
      { value: 'match' },
    );
    expect(getRawOneMock).toHaveBeenCalled();
  });

  test('returns false when queryBuilder.getRawOne returns undefined', async () => {
    getRawOneMock.mockResolvedValue(undefined);

    const validator = new ExistsInValidator();

    const args: BaseValidatorArguments = {
      value: 'nope',
      targetName: 'name',
      object: {},
      property: 'name',
      constraints: [DummyEntity, 'name', undefined],
    };

    await expect(validator.validate('nope', args)).resolves.toBe(false);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');
    expect(builder.where).toHaveBeenCalledWith(
      `entityOrTableName.name = :value`,
      { value: 'nope' },
    );
    expect(getRawOneMock).toHaveBeenCalled();
  });

  test('works with numeric ids and column "id"', async () => {
    const found = { '1': 1 };
    getRawOneMock.mockResolvedValue(found);

    const validator = new ExistsInValidator();

    const args: BaseValidatorArguments = {
      value: 42,
      targetName: 'id',
      object: {},
      property: 'id',
      constraints: [DummyEntity, 'id', undefined],
    };

    await expect(validator.validate(42, args)).resolves.toBe(true);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');
    expect(builder.where).toHaveBeenCalledWith(
      `entityOrTableName.id = :value`,
      { value: 42 },
    );
    expect(getRawOneMock).toHaveBeenCalled();
  });

  test('uses provided table name string and dataSourceName (third constraint)', async () => {
    getRawOneMock.mockResolvedValue({ '1': 1 });

    const validator = new ExistsInValidator();

    const args: BaseValidatorArguments = {
      value: 'v',
      targetName: 'col',
      object: {},
      property: 'col',
      constraints: ['my_table', 'col', 'customDS'],
    };

    const ds = { ...mockDataSource };
    registerDataSourceForValidation(ds, 'customDS');

    await expect(validator.validate('v', args)).resolves.toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ds.getRepository).toHaveBeenCalledWith('my_table');
    expect(builder.where).toHaveBeenCalledWith(
      `entityOrTableName.col = :value`,
      { value: 'v' },
    );
  });

  test('throws ValidationConfigurationError when constraints are invalid', async () => {
    const validator = new ExistsInValidator();
    const args: BaseValidatorArguments = {
      value: 'x',
      targetName: 'p',
      object: {},
      property: 'p',
      constraints: [
        undefined,
        undefined,
        undefined,
      ] as unknown as BaseValidatorArguments['constraints'],
    };
    await expect(validator.validate('x', args)).rejects.toThrow(
      ValidationConfigurationError,
    );
  });

  test('wraps repository errors into ValidationQueryError', async () => {
    repo.createQueryBuilder.mockImplementation(() => {
      throw new Error('boom');
    });

    const validator = new ExistsInValidator();
    const args: BaseValidatorArguments = {
      value: 'x',
      targetName: 'name',
      object: {},
      property: 'name',
      constraints: [DummyEntity, 'name', undefined],
    };

    await expect(validator.validate('x', args)).rejects.toThrow(
      ValidationQueryError,
    );
  });

  test('defaultMessage formats correctly', () => {
    const validator = new ExistsInValidator();
    const args: BaseValidatorArguments = {
      value: undefined,
      targetName: 'col',
      object: {},
      property: 'col',
      constraints: ['my_table', 'col', undefined],
    };
    expect(validator.defaultMessage(args)).toContain(
      'does not exist in my_table.col',
    );
  });

  test('returns false for null/undefined values', async () => {
    const validator = new ExistsInValidator();

    const args: BaseValidatorArguments = {
      value: null,
      targetName: 'id',
      object: {},
      property: 'id',
      constraints: [DummyEntity, 'id', undefined],
    };

    await expect(validator.validate(null, args)).resolves.toBe(false);

    const argsUndef: BaseValidatorArguments = {
      value: undefined,
      targetName: 'id',
      object: {},
      property: 'id',
      constraints: [DummyEntity, 'id', undefined],
    };

    await expect(validator.validate(undefined, argsUndef)).resolves.toBe(false);
  });

  test('defaultMessage falls back to "entity" when entity has no name', () => {
    const validator = new ExistsInValidator();
    const args: BaseValidatorArguments = {
      value: undefined,
      targetName: 'col',
      object: {},
      property: 'col',
      constraints: [
        {} as unknown as BaseValidatorArguments['constraints'][0],
        'col',
        undefined,
      ],
    };
    expect(validator.defaultMessage(args)).toContain('entity.col');
  });

  test('defaultMessage with each=true formats message for array validation', () => {
    const validator = new ExistsInValidator();
    const args: BaseValidatorArguments = {
      value: [1, 2, 3],
      targetName: 'id',
      object: {},
      property: 'ids',
      constraints: [DummyEntity, 'id', undefined, true],
    };
    const message = validator.defaultMessage(args);
    expect(message).toContain('do not all exist');
    expect(message).toContain('DummyEntity.id');
  });
});

describe('ExistsInValidator each test suite', () => {
  class DummyEntity {
    id?: number;
  }

  type Builder = {
    select: jest.Mock;
    distinct: jest.Mock;
    where: jest.Mock;
    take: jest.Mock;
    getRawOne: jest.Mock;
    getRawMany: jest.Mock;
  };

  let builder: Builder;
  const validator = new ExistsInValidator();

  function makeArgs(value: unknown): BaseValidatorArguments {
    return {
      value,
      targetName: 'ids',
      object: {},
      property: 'ids',
      constraints: [DummyEntity, 'id', undefined, true],
    };
  }

  beforeEach(() => {
    clearDataSourcesForValidation();
    builder = {
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    registerDataSourceForValidation({
      isInitialized: true,
      initialize: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(builder),
      }),
    });
  });

  test('checks all values of an array in one query', async () => {
    builder.getRawMany.mockResolvedValue([{ value: 1 }, { value: 2 }]);
    await expect(validator.validate([1, 2], makeArgs([1, 2]))).resolves.toBe(
      true,
    );
    expect(builder.getRawMany).toHaveBeenCalledTimes(1);
    expect(builder.getRawOne).not.toHaveBeenCalled();
  });

  test('fails when one value does not exist', async () => {
    builder.getRawMany.mockResolvedValue([{ value: 1 }]);
    await expect(validator.validate([1, 3], makeArgs([1, 3]))).resolves.toBe(
      false,
    );
  });

  test('supports Sets', async () => {
    const value = new Set([1]);
    builder.getRawMany.mockResolvedValue([{ value: 1 }]);
    await expect(validator.validate(value, makeArgs(value))).resolves.toBe(
      true,
    );
  });

  test('passes empty collections without querying', async () => {
    await expect(validator.validate([], makeArgs([]))).resolves.toBe(true);
    expect(builder.getRawMany).not.toHaveBeenCalled();
  });

  test('fails when the collection contains null or undefined without querying', async () => {
    await expect(
      validator.validate([1, null], makeArgs([1, null])),
    ).resolves.toBe(false);
    await expect(
      validator.validate([undefined], makeArgs([undefined])),
    ).resolves.toBe(false);
    expect(builder.getRawMany).not.toHaveBeenCalled();
  });
});
