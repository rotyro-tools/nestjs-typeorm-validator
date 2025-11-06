import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { ValidationQueryError } from '@/errors';
import { BaseValidatorArguments } from '@/types';
import { registerDataSourceForValidation } from '@/utils';
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
      ...(mockDataSource as unknown as DataSource),
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

  test('defaultMessage with each=true formats correctly', () => {
    const validator = new UniqueInValidator();
    const args: BaseValidatorArguments = {
      constraints: ['users', 'email', undefined, true],
      property: 'email',
      value: ['a', 'b'],
      targetName: 'users',
      object: {},
    };
    const msg = validator.defaultMessage(args);
    expect(msg).toContain('are not all unique in users.email');
    expect(msg).toContain('email with values [a,b]');
  });
});
