import { ValidationConfigurationError, ValidationQueryError } from '@/errors';
import type { BaseValidatorArguments } from '@/types';
import { registerDataSourceForValidation } from '@/utils';
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
    } as Parameters<typeof registerDataSourceForValidation>[0];

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
      constraints: [DummyEntity, 'name', undefined, false],
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
      constraints: [DummyEntity, 'name', undefined, false],
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
      constraints: [DummyEntity, 'id', undefined, false],
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
      constraints: ['my_table', 'col', 'customDS', false],
    };

    const ds = { ...mockDataSource } as Parameters<
      typeof registerDataSourceForValidation
    >[0];
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
        false,
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
      constraints: [DummyEntity, 'name', undefined, false],
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
      constraints: ['my_table', 'col', undefined, false],
    };
    expect(validator.defaultMessage(args)).toContain(
      'does not exist in my_table.col',
    );
  });

  test('defaultMessage with each=true formats correctly', () => {
    const validator = new ExistsInValidator();
    const args: BaseValidatorArguments = {
      value: ['a', 'b'],
      targetName: 'col',
      object: {},
      property: 'col',
      constraints: ['my_table', 'col', undefined, true],
    };
    const msg = validator.defaultMessage(args);
    expect(msg).toContain('do not all exist in my_table.col');
    expect(msg).toContain('col with values [a,b]');
  });

  test('returns true when each=true and all values exist', async () => {
    const validator = new ExistsInValidator();

    const spy = jest
      .spyOn(
        ExistsInValidator.prototype as unknown as {
          valueExists: (...args: unknown[]) => Promise<unknown>;
        },
        'valueExists',
      )
      .mockResolvedValue([true, true] as unknown as Promise<unknown>);

    const args: BaseValidatorArguments = {
      value: ['a', 'b'],
      targetName: 'col',
      object: {},
      property: 'col',
      constraints: ['my_table', 'col', undefined, true],
    };

    await expect(validator.validate(['a', 'b'], args)).resolves.toBe(true);

    spy.mockRestore();
  });

  test('returns false when each=true and not all values exist', async () => {
    const validator = new ExistsInValidator();

    const spy = jest
      .spyOn(
        ExistsInValidator.prototype as unknown as {
          valueExists: (...args: unknown[]) => Promise<unknown>;
        },
        'valueExists',
      )
      .mockResolvedValue([true, false] as unknown as Promise<unknown>);

    const args: BaseValidatorArguments = {
      value: ['x', 'y'],
      targetName: 'col',
      object: {},
      property: 'col',
      constraints: ['my_table', 'col', undefined, true],
    };

    await expect(validator.validate(['x', 'y'], args)).resolves.toBe(false);

    spy.mockRestore();
  });

  test('returns false for null/undefined values', async () => {
    const validator = new ExistsInValidator();

    const args: BaseValidatorArguments = {
      value: null,
      targetName: 'id',
      object: {},
      property: 'id',
      constraints: [DummyEntity, 'id', undefined, false],
    };

    await expect(validator.validate(null, args)).resolves.toBe(false);

    const argsUndef: BaseValidatorArguments = {
      value: undefined,
      targetName: 'id',
      object: {},
      property: 'id',
      constraints: [DummyEntity, 'id', undefined, false],
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
        false,
      ],
    };
    expect(validator.defaultMessage(args)).toContain('entity.col');
  });
});
