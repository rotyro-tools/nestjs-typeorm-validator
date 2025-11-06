import type { EntityTarget, ObjectLiteral } from 'typeorm';

import {
  DataSourceNotRegisteredError,
  ValidationConfigurationError,
  ValidationQueryError,
} from '@/errors';
import type { BaseValidatorArguments, DataSourceLike } from '@/types';
import { registerDataSourceForValidation } from '@/utils';
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
    expect(v.callGetEntityName({} as unknown)).toBe('entity');
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

    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col'],
    } as unknown as BaseValidatorArguments;

    getRawOneMock.mockResolvedValue(undefined);
    await expect(v.callValueExists('x', args)).resolves.toEqual([false, false]);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');

    getRawOneMock.mockResolvedValue({ '1': 1 });
    await expect(v.callValueExists('y', args)).resolves.toEqual([true, true]);
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

    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
      'namedDS',
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: ['table_str', 'col', 'namedDS'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('z', args)).resolves.toEqual([true, true]);
    expect(mockDataSource.getRepository).toHaveBeenCalledWith('table_str');
  });

  test('valueExists with each=true returns true when all unique values found', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue({ cnt: '2' });
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', undefined, true],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('a,b,a', args)).resolves.toEqual([
      true,
      true,
    ]);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');
  });

  test('valueExists with each=true returns false when not all unique values found', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue({ cnt: '1' });
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', undefined, true],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('a,b,a', args)).resolves.toEqual([
      true,
      false,
    ]);
  });

  test('valueExists with each=true and empty values returns true', async () => {
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', undefined, true],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('', args)).resolves.toEqual([false, false]);
    await expect(v.callValueExists(',', args)).resolves.toEqual([false, false]);
  });

  test('valueExists throws ValidationConfigurationError when repository reports missing metadata', async () => {
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn(() => {
        throw new Error('No metadata found for "X"');
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'id',
      constraints: [DummyEntity, 'id'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists(1, args)).rejects.toThrow(
      ValidationConfigurationError,
    );
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('val', args)).rejects.toThrow(
      ValidationQueryError,
    );
  });

  test('valueExists throws ValidationConfigurationError when repository reports "doesn\'t exist"', async () => {
    const repo: { createQueryBuilder: jest.Mock } = {
      createQueryBuilder: jest.fn(() => {
        throw new Error("Table doesn't exist");
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'id',
      constraints: [DummyEntity, 'id'],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists(1, args)).rejects.toThrow(
      ValidationConfigurationError,
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', '', false],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('val', args)).resolves.toEqual([true, true]);
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [null, 'col', undefined, false],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('val', args)).resolves.toEqual([true, true]);
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

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

  test('valueExists handles countResult without cnt property', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue({ notcnt: 123 });
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', undefined, true],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('a,b', args)).resolves.toEqual([
      false,
      false,
    ]);
  });

  test('valueExists with each=true treats undefined countResult as zero (covers (countResult && ...))', async () => {
    const getRawOneMock = jest.fn().mockResolvedValue(undefined);
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
    registerDataSourceForValidation(
      mockDataSource as unknown as DataSourceLike,
    );

    const v = new TestValidator();
    const args = {
      property: 'col',
      constraints: [DummyEntity, 'col', undefined, true],
    } as unknown as BaseValidatorArguments;

    await expect(v.callValueExists('a,b', args)).resolves.toEqual([
      false,
      false,
    ]);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('entityOrTableName');
  });
});
