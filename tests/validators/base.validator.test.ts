import type { EntityTarget, ObjectLiteral } from 'typeorm';

import {
  DataSourceNotInitializedError,
  DataSourceNotRegisteredError,
  ValidationConfigurationError,
  ValidationQueryError,
} from '@/errors';
import type { BaseValidatorArguments, ValidationQueryOptions } from '@/types';
import {
  clearDataSourcesForValidation,
  registerDataSourceForValidation,
} from '@/utils';
import { BaseValidator } from '@/validators';

jest.mock('typeorm', () => ({
  getRepository: jest.fn(),
}));

describe('BaseValidator test suite', () => {
  class TestValidator extends BaseValidator {
    public callValidateConstraints(args: BaseValidatorArguments, name: string) {
      return this.validateConstraints(args, name);
    }
    public callGetEntityName(entity: unknown) {
      return this.getEntityName(entity as EntityTarget<ObjectLiteral>);
    }
    public callValueExists(value: unknown, args: BaseValidatorArguments) {
      return this.valueExists(value, args);
    }
  }

  class DummyEntity {
    id?: number;
    col?: string;
  }

  test('validateConstraints throws ValidationConfigurationError when missing params', () => {
    const v = new TestValidator();
    const args = {
      property: 'prop',
      constraints: [undefined, undefined],
    } as unknown as BaseValidatorArguments;
    expect(() => v.callValidateConstraints(args, 'Test')).toThrow(
      ValidationConfigurationError,
    );
  });

  test('getEntityName returns name for class and for string', () => {
    const v = new TestValidator();
    class NamedEntity {}
    expect(v.callGetEntityName(NamedEntity)).toBe('NamedEntity');
    expect(v.callGetEntityName('my_table')).toBe('my_table');
  });

  test('getEntityName falls back to "entity" when no name is present', () => {
    const v = new TestValidator();
    expect(v.callGetEntityName({})).toBe('entity');
  });

  test('valueExists throws DataSourceNotRegisteredError when no data source registered', async () => {
    const v = new TestValidator();
    const args = {
      property: 'id',
      constraints: [DummyEntity, 'id'],
    } as unknown as BaseValidatorArguments;
    await expect(v.callValueExists(1, args)).rejects.toThrow(
      DataSourceNotRegisteredError,
    );
  });

  test('valueExists returns true/false depending on query result when data source registered', async () => {
    const getRawOneMock = jest.fn();
    const builder: {
      select: jest.Mock;
      where: jest.Mock;
      take: jest.Mock;
      getRawOne: jest.Mock;
    } = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    };

    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };

    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: (arg?: EntityTarget<ObjectLiteral>) => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };

    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col'],
    } as unknown as BaseValidatorArguments;

    getRawOneMock.mockResolvedValue(undefined);
    await expect(v.callValueExists('x', args)).resolves.toBe(false);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');

    getRawOneMock.mockResolvedValue({ '1': 1 });
    await expect(v.callValueExists('y', args)).resolves.toBe(true);
  });

  test('valueExists works with string table name and custom data source name', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue({ '1': 1 });
    const builder: {
      select: jest.Mock;
      where: jest.Mock;
      take: jest.Mock;
      getRawOne: jest.Mock;
    } = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    };

    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };

    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: (arg?: EntityTarget<ObjectLiteral> | string) => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };

    registerDataSourceForValidation(mockDataSource, 'namedDS');

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: ['table_str', 'col', 'namedDS'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('z', args)).resolves.toBe(true);
    expect(mockDataSource.getRepository).toHaveBeenCalledWith('table_str');
  });

  test('valueExists throws ValidationConfigurationError when TypeORM reports missing metadata', async () => {
    const metadataError = new Error('No metadata for "DummyEntity" was found.');
    metadataError.name = 'EntityMetadataNotFoundError';
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn(() => {
        throw metadataError;
      }),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'id',
      constraints: [DummyEntity, 'id'],
    } as unknown as BaseValidatorArguments;

    const error = await v.callValueExists(1, args).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationConfigurationError);
    expect((error as ValidationConfigurationError).message).toContain(
      'No TypeORM metadata found for "DummyEntity"',
    );
    expect((error as ValidationConfigurationError).cause).toBe(metadataError);
  });

  test('valueExists throws ValidationQueryError for generic DB errors', async () => {
    const getRawOneMock = jest.fn().mockRejectedValue(new Error('boom'));
    const builder: {
      select: jest.Mock;
      where: jest.Mock;
      take: jest.Mock;
      getRawOne: jest.Mock;
    } = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    };
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('val', args)).rejects.toThrow(
      ValidationQueryError,
    );
  });

  test('valueExists reports a missing table as a ValidationQueryError with the database message', async () => {
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn(() => {
        throw new Error("Table 'db.dummy_entity' doesn't exist");
      }),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'id',
      constraints: [DummyEntity, 'id'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists(1, args)).rejects.toThrow(
      new ValidationQueryError(
        'Failed to validate in DummyEntity.id',
        new Error("Table 'db.dummy_entity' doesn't exist"),
      ).message,
    );
  });

  test('valueExists wraps non-Error throwables into ValidationQueryError with wrapped cause', async () => {
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'boom-string';
      }),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col'],
    } as unknown as BaseValidatorArguments;

    try {
      await v.callValueExists('val', args);
      throw new Error('expected throw');
    } catch (errUnknown) {
      const err = errUnknown as ValidationQueryError & {
        cause?: Error;
        context?: unknown;
      };
      expect(err).toBeInstanceOf(ValidationQueryError);
      expect(err.cause).toBeInstanceOf(Error);
      expect(err.cause!.message).toBe('boom-string');
      expect(err.context).toBeDefined();
      expect(err.message).toContain('Failed to validate');
    }
  });

  test('valueExists handles empty dataSourceName gracefully', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue({ '1': 1 });
    const builder: {
      select: jest.Mock;
      where: jest.Mock;
      take: jest.Mock;
      getRawOne: jest.Mock;
    } = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    };
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', ''],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('val', args)).resolves.toBe(true);
  });

  test('valueExists handles null entityOrTableName gracefully', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue({ '1': 1 });
    const builder: {
      select: jest.Mock;
      where: jest.Mock;
      take: jest.Mock;
      getRawOne: jest.Mock;
    } = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    };
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [null, 'col', undefined],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('val', args)).resolves.toBe(true);
  });

  test('valueExists handles invalid error types by wrapping them in ValidationQueryError', async () => {
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 12345;
      }),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col'],
    } as unknown as BaseValidatorArguments;

    try {
      await v.callValueExists('val', args);
      throw new Error('Expected throw');
    } catch (errUnknown) {
      const err = errUnknown as ValidationQueryError & { cause?: Error };
      expect(err).toBeInstanceOf(ValidationQueryError);
      expect(err.cause).toBeInstanceOf(Error);
      expect(err.cause!.message).toBe('12345');
    }
  });

  test('valueExists with each=true validates single values (class-validator per-element calling)', async () => {
    const getRawOneMock = jest.fn();
    const builder: {
      select: jest.Mock;
      where: jest.Mock;
      take: jest.Mock;
      getRawOne: jest.Mock;
    } = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    };
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    type MockDS = {
      isInitialized: boolean;
      initialize: () => Promise<MockDS>;
      getRepository: () => unknown;
    };
    const mockDataSource: MockDS = {
      isInitialized: true,
      initialize() {
        this.isInitialized = true;
        return Promise.resolve(this);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    };
    registerDataSourceForValidation(mockDataSource);

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', undefined],
    } as unknown as BaseValidatorArguments;

    getRawOneMock.mockResolvedValue({ '1': 1 });
    await expect(v.callValueExists('not-an-array', args)).resolves.toBe(true);

    getRawOneMock.mockResolvedValue(undefined);
    await expect(v.callValueExists(123, args)).resolves.toBe(false);
  });
});

describe('BaseValidator batch and query options test suite', () => {
  class BatchValidator extends BaseValidator {
    public each(value: unknown, args: BaseValidatorArguments) {
      return this.getEachValues(value, args);
    }
    public exists(
      value: unknown,
      args: BaseValidatorArguments,
      options?: ValidationQueryOptions,
    ) {
      return this.valueExists(value, args, options);
    }
    public any(
      values: unknown[],
      args: BaseValidatorArguments,
      options?: ValidationQueryOptions,
    ) {
      return this.anyValueExists(values, args, options);
    }
    public all(
      values: unknown[],
      args: BaseValidatorArguments,
      options?: ValidationQueryOptions,
    ) {
      return this.allValuesExist(values, args, options);
    }
  }

  class DummyEntity {
    id?: number;
    col?: string;
  }

  type Builder = {
    select: jest.Mock;
    distinct: jest.Mock;
    where: jest.Mock;
    take: jest.Mock;
    withDeleted: jest.Mock;
    getRawOne: jest.Mock;
    getRawMany: jest.Mock;
  };

  let builder: Builder;
  let repo: { createQueryBuilder: jest.Mock };
  const v = new BatchValidator();
  const args = {
    property: 'col',
    constraints: [DummyEntity, 'col'],
  } as unknown as BaseValidatorArguments;
  const eachArgs = {
    property: 'col',
    constraints: [DummyEntity, 'col', undefined, true],
  } as unknown as BaseValidatorArguments;

  beforeEach(() => {
    clearDataSourcesForValidation();
    builder = {
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    repo = { createQueryBuilder: jest.fn().mockReturnValue(builder) };
    registerDataSourceForValidation({
      isInitialized: true,
      initialize: jest.fn(),
      getRepository: jest.fn().mockReturnValue(repo),
    });
  });

  function whereValues(call: number): unknown[] {
    const calls = builder.where.mock.calls as [string, { values: unknown[] }][];
    return calls[call][1].values;
  }

  test('getEachValues returns undefined when each is not enabled', () => {
    expect(v.each([1, 2], args)).toBeUndefined();
  });

  test('getEachValues returns the values of arrays, Sets and Maps', () => {
    expect(v.each([1, 2], eachArgs)).toEqual([1, 2]);
    expect(v.each(new Set(['a', 'b']), eachArgs)).toEqual(['a', 'b']);
    expect(
      v.each(
        new Map([
          ['k1', 'x'],
          ['k2', 'y'],
        ]),
        eachArgs,
      ),
    ).toEqual(['x', 'y']);
  });

  test('getEachValues returns undefined for non-collection values with each', () => {
    expect(v.each('single', eachArgs)).toBeUndefined();
  });

  test('valueExists treats a null raw result as not found', async () => {
    builder.getRawOne.mockResolvedValue(null);
    await expect(v.exists('x', args)).resolves.toBe(false);
  });

  test('valueExists includes soft-deleted rows only when requested', async () => {
    await v.exists('x', args);
    expect(builder.withDeleted).not.toHaveBeenCalled();

    await v.exists('x', args, { withDeleted: true });
    expect(builder.withDeleted).toHaveBeenCalledTimes(1);
  });

  test('valueExists rethrows DataSourceNotInitializedError unchanged', async () => {
    registerDataSourceForValidation({
      isInitialized: false,
      initialize: jest.fn(),
      getRepository: jest.fn(),
    });
    await expect(v.exists('x', args)).rejects.toThrow(
      DataSourceNotInitializedError,
    );
  });

  test('valueExists falls back to the default data source for a non-string name', async () => {
    const nonStringArgs = {
      property: 'col',
      constraints: [DummyEntity, 'col', 42],
    } as unknown as BaseValidatorArguments;
    builder.getRawOne.mockResolvedValue({ '1': 1 });
    await expect(v.exists('x', nonStringArgs)).resolves.toBe(true);
  });

  test('anyValueExists runs one IN query and returns false when nothing matches', async () => {
    await expect(v.any(['a', 'b', 'a'], args)).resolves.toBe(false);
    expect(builder.getRawOne).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledWith(
      'entityOrTableName.col IN (:...values)',
      { values: ['a', 'b'] },
    );
    expect(builder.withDeleted).not.toHaveBeenCalled();
  });

  test('anyValueExists stops at the first chunk with a match', async () => {
    builder.getRawOne.mockResolvedValue({ '1': 1 });
    const values = Array.from({ length: 1200 }, (_, i) => i);
    await expect(v.any(values, args, { withDeleted: true })).resolves.toBe(
      true,
    );
    expect(builder.getRawOne).toHaveBeenCalledTimes(1);
    expect(builder.withDeleted).toHaveBeenCalledTimes(1);
  });

  test('anyValueExists splits large inputs into chunks of 500 distinct values', async () => {
    const values = Array.from({ length: 1200 }, (_, i) => i);
    await expect(v.any(values, args)).resolves.toBe(false);
    expect(builder.getRawOne).toHaveBeenCalledTimes(3);
    expect(whereValues(0)).toHaveLength(500);
    expect(whereValues(1)).toHaveLength(500);
    expect(whereValues(2)).toHaveLength(200);
  });

  test('allValuesExist returns true when every value is found by exact match', async () => {
    builder.getRawMany.mockResolvedValue([{ value: 1 }, { value: 2 }]);
    await expect(v.all(['1', 2, 2], args)).resolves.toBe(true);
    expect(builder.getRawMany).toHaveBeenCalledTimes(1);
    expect(builder.select).toHaveBeenCalledWith(
      'entityOrTableName.col',
      'value',
    );
    expect(builder.distinct).toHaveBeenCalledWith(true);
    expect(builder.getRawOne).not.toHaveBeenCalled();
  });

  test('allValuesExist re-checks values without an exact match one by one', async () => {
    builder.getRawMany.mockResolvedValue([{ value: 'abc' }]);
    builder.getRawOne.mockResolvedValue({ '1': 1 });
    await expect(v.all(['abc', 'ABC'], args)).resolves.toBe(true);
    expect(builder.getRawOne).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenLastCalledWith(
      'entityOrTableName.col = :value',
      { value: 'ABC' },
    );
  });

  test('allValuesExist returns false as soon as a value is confirmed missing', async () => {
    builder.getRawMany.mockResolvedValue([]);
    builder.getRawOne.mockResolvedValue(undefined);
    await expect(v.all(['x', 'y'], args, { withDeleted: true })).resolves.toBe(
      false,
    );
    expect(builder.getRawOne).toHaveBeenCalledTimes(1);
  });

  test('allValuesExist queries every chunk of a large input', async () => {
    builder.getRawMany.mockImplementation(() =>
      Promise.resolve(
        whereValues(builder.where.mock.calls.length - 1).map((value) => ({
          value,
        })),
      ),
    );
    const values = Array.from({ length: 1001 }, (_, i) => `v${i}`);
    await expect(v.all(values, args)).resolves.toBe(true);
    expect(builder.getRawMany).toHaveBeenCalledTimes(3);
  });

  test('batch queries wrap database errors with the validated values in the context', async () => {
    builder.getRawMany.mockRejectedValue(new Error('Too many connections'));
    const error = await v.all(['a'], args).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationQueryError);
    expect((error as ValidationQueryError).message).toBe(
      'Failed to validate in DummyEntity.col: Too many connections',
    );
    expect((error as ValidationQueryError).context).toEqual(
      expect.objectContaining({ value: ['a'] }),
    );
  });
});
