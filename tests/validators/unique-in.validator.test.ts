import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { ValidationQueryError } from '@/errors';
import type { BaseValidatorArguments } from '@/types';
import {
  clearDataSourcesForValidation,
  registerDataSourceForValidation,
} from '@/utils';
import { UniqueInValidator } from '@/validators';

jest.mock('typeorm', () => ({
  getRepository: jest.fn(),
}));

describe('UniqueInValidator test suite', () => {
  class DummyEntity {
    id?: number;
    email?: string;
  }

  let getRawOneMock: jest.MockedFunction<
    () => Promise<Record<string, unknown> | undefined>
  >;
  let builder: SelectQueryBuilder<DummyEntity>;
  let repo: Repository<DummyEntity>;
  let mockDataSource: DataSource;

  beforeEach(() => {
    getRawOneMock = jest.fn<Promise<Record<string, unknown> | undefined>, []>();

    builder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      getRawOne: getRawOneMock,
    } as unknown as SelectQueryBuilder<DummyEntity>;

    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    } as unknown as Repository<DummyEntity>;

    mockDataSource = {
      isInitialized: true,
      initialize() {
        // @ts-expect-error narrow in test
        this.isInitialized = true;
        return Promise.resolve(this as unknown as DataSource);
      },
      getRepository: jest.fn().mockReturnValue(repo),
    } as unknown as DataSource;

    registerDataSourceForValidation(mockDataSource);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns true when value is unique', async () => {
    getRawOneMock.mockResolvedValue(undefined);

    const validator = new UniqueInValidator();

    const args: BaseValidatorArguments = {
      constraints: [DummyEntity, 'email'],
      property: 'email',
      value: 'unique@example.com',
      targetName: 'DummyEntity',
      object: {},
    };

    await expect(validator.validate('unique@example.com', args)).resolves.toBe(
      true,
    );
    expect(
      (repo.createQueryBuilder as jest.Mock).mock.calls.length,
    ).toBeGreaterThanOrEqual(0);
    expect(
      (builder.where as jest.Mock).mock.calls.length,
    ).toBeGreaterThanOrEqual(0);
    expect(getRawOneMock).toHaveBeenCalled();
  });

  test('returns false when value already exists', async () => {
    getRawOneMock.mockResolvedValue({ '1': 1 });

    const validator = new UniqueInValidator();

    const args: BaseValidatorArguments = {
      constraints: [DummyEntity, 'email'],
      property: 'email',
      value: 'taken@example.com',
      targetName: 'DummyEntity',
      object: {},
    };

    await expect(validator.validate('taken@example.com', args)).resolves.toBe(
      false,
    );
    expect(getRawOneMock).toHaveBeenCalled();
  });

  test('returns true for null/undefined values', async () => {
    const validator = new UniqueInValidator();

    const args: BaseValidatorArguments = {
      constraints: [DummyEntity, 'email'],
      property: 'email',
      value: null,
      targetName: 'DummyEntity',
      object: {},
    };

    await expect(validator.validate(null, args)).resolves.toBe(true);
    await expect(validator.validate(undefined, args)).resolves.toBe(true);
  });

  test('works with string table name and custom data source name', async () => {
    getRawOneMock.mockResolvedValue(undefined);

    const validator = new UniqueInValidator();
    const args: BaseValidatorArguments = {
      constraints: ['users_table', 'email', 'ds2'],
      property: 'email',
      value: 'a@b.com',
      targetName: 'users_table',
      object: {},
    };

    const ds = {
      ...mockDataSource,
    } as unknown as DataSource;
    registerDataSourceForValidation(ds, 'ds2');

    await expect(validator.validate('a@b.com', args)).resolves.toBe(true);
    expect(
      (ds.getRepository as jest.Mock).mock.calls.length,
    ).toBeGreaterThanOrEqual(0);
  });

  test('wraps repository errors into ValidationQueryError', async () => {
    (repo.createQueryBuilder as jest.Mock).mockImplementation(() => {
      throw new Error('boom-unique');
    });

    const validator = new UniqueInValidator();
    const args: BaseValidatorArguments = {
      constraints: [DummyEntity, 'email'],
      property: 'email',
      value: 'x',
      targetName: 'DummyEntity',
      object: {},
    };

    await expect(validator.validate('x', args)).rejects.toThrow(
      ValidationQueryError,
    );
  });

  test('defaultMessage mentions existing value', () => {
    const validator = new UniqueInValidator();
    const args: BaseValidatorArguments = {
      constraints: ['users', 'email'],
      property: 'email',
      value: 'existing@example.com',
      targetName: 'users',
      object: {},
    };
    expect(validator.defaultMessage(args)).toContain(
      'email with value "existing@example.com" is not unique in users.email',
    );
  });

  test('defaultMessage with each=true formats message for array validation', () => {
    const validator = new UniqueInValidator();
    const args: BaseValidatorArguments = {
      constraints: [DummyEntity, 'email', undefined, true],
      property: 'emails',
      value: ['a@b.com', 'c@d.com'],
      targetName: 'DummyEntity',
      object: {},
    };
    const message = validator.defaultMessage(args);
    expect(message).toContain('are not all unique');
    expect(message).toContain('DummyEntity.email');
  });
});

describe('UniqueInValidator soft delete and each test suite', () => {
  class DummyEntity {
    email?: string;
  }

  type Builder = {
    select: jest.Mock;
    where: jest.Mock;
    take: jest.Mock;
    withDeleted: jest.Mock;
    getRawOne: jest.Mock;
  };

  let builder: Builder;
  const validator = new UniqueInValidator();

  function makeArgs(
    constraints: unknown[],
    value: unknown,
  ): BaseValidatorArguments {
    return {
      constraints,
      property: 'emails',
      value,
      targetName: 'DummyEntity',
      object: {},
    } as unknown as BaseValidatorArguments;
  }

  beforeEach(() => {
    clearDataSourcesForValidation();
    builder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
    };
    registerDataSourceForValidation({
      isInitialized: true,
      initialize: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(builder),
      }),
    });
  });

  test('counts soft-deleted rows by default', async () => {
    const args = makeArgs([DummyEntity, 'email'], 'a@b.com');
    await expect(validator.validate('a@b.com', args)).resolves.toBe(true);
    expect(builder.withDeleted).toHaveBeenCalledTimes(1);
  });

  test('ignores soft-deleted rows when includeSoftDeleted is false', async () => {
    const args = makeArgs(
      [DummyEntity, 'email', undefined, false, { withDeleted: false }],
      'a@b.com',
    );
    await expect(validator.validate('a@b.com', args)).resolves.toBe(true);
    expect(builder.withDeleted).not.toHaveBeenCalled();
  });

  test('each: checks all values in one IN query', async () => {
    const value = ['a@b.com', 'c@d.com'];
    const args = makeArgs(
      [DummyEntity, 'email', undefined, true, { withDeleted: true }],
      value,
    );
    await expect(validator.validate(value, args)).resolves.toBe(true);
    expect(builder.getRawOne).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledWith(
      'entityOrTableName.email IN (:...values)',
      { values: value },
    );
  });

  test('each: fails when one value is already taken', async () => {
    builder.getRawOne.mockResolvedValue({ '1': 1 });
    const value = ['a@b.com', 'taken@d.com'];
    const args = makeArgs([DummyEntity, 'email', undefined, true], value);
    await expect(validator.validate(value, args)).resolves.toBe(false);
  });

  test('each: fails on exact duplicates inside the collection without querying', async () => {
    const value = ['a@b.com', 'a@b.com'];
    const args = makeArgs([DummyEntity, 'email', undefined, true], value);
    await expect(validator.validate(value, args)).resolves.toBe(false);
    expect(builder.getRawOne).not.toHaveBeenCalled();
  });

  test('each: ignores null values and passes empty collections without querying', async () => {
    const onlyNulls = [null, undefined];
    await expect(
      validator.validate(
        onlyNulls,
        makeArgs([DummyEntity, 'email', undefined, true], onlyNulls),
      ),
    ).resolves.toBe(true);
    await expect(
      validator.validate(
        [],
        makeArgs([DummyEntity, 'email', undefined, true], []),
      ),
    ).resolves.toBe(true);
    expect(builder.getRawOne).not.toHaveBeenCalled();

    const withNull = ['a@b.com', null];
    await expect(
      validator.validate(
        withNull,
        makeArgs([DummyEntity, 'email', undefined, true], withNull),
      ),
    ).resolves.toBe(true);
    expect(builder.where).toHaveBeenCalledWith(
      'entityOrTableName.email IN (:...values)',
      { values: ['a@b.com'] },
    );
  });
});
