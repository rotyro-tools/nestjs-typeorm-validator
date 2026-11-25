import type {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import {
  ValidationConfigurationError,
  ValidationQueryError,
  ValidatorError,
} from '@/errors';
import type { BaseValidatorArguments, ValidationQueryOptions } from '@/types';
import { getDataSourceForValidation, toError } from '@/utils';

const QUERY_ALIAS = 'entityOrTableName';
const IN_CLAUSE_CHUNK_SIZE = 500;

/**
 * Base validator.
 *
 * @description
 * Provides common functionality for validators,
 * including data source management, error handling, and entity name resolution.
 *
 * @abstract
 * @public
 */
export abstract class BaseValidator {
  /**
   * Validates the configuration constraints.
   *
   * @param validatorArguments - Validation arguments
   * @throws {ValidationConfigurationError} if constraints are invalid
   *
   * @protected
   */
  protected validateConstraints(
    validatorArguments: BaseValidatorArguments,
    validatorName: string,
  ): void {
    const [entityOrTableName, columnName] = validatorArguments.constraints;

    if (!entityOrTableName || !columnName) {
      throw new ValidationConfigurationError(
        `${validatorName}: entity/table name and column name are required`,
        {
          property: validatorArguments.property,
          constraints: validatorArguments.constraints,
        },
      );
    }
  }

  /**
   * Returns the values to validate one by one when the decorator was declared with `each: true`
   * and the value is an array, a Set or a Map (Map values), mirroring class-validator's `each` behavior.
   *
   * @param value - The validated value
   * @param validatorArguments - Validator arguments
   * @returns The collection values, or `undefined` when the value must be validated as a single value
   *
   * @protected
   */
  protected getEachValues(
    value: unknown,
    validatorArguments: BaseValidatorArguments,
  ): unknown[] | undefined {
    if (validatorArguments.constraints[3] !== true) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value as unknown[];
    }

    if (value instanceof Set || value instanceof Map) {
      return Array.from(
        (value as Set<unknown> | Map<unknown, unknown>).values(),
      );
    }

    return undefined;
  }

  /**
   * Executes a database query to check for value existence.
   *
   * Returns true if the value exists.
   *
   * @param value - The value to query
   * @param validatorArguments - Validator arguments
   * @param queryOptions - Query options
   * @returns Promise resolving to true if value exists, false otherwise
   * @throws {ValidationQueryError} if database query fails
   *
   * @protected
   */
  protected async valueExists(
    value: unknown,
    validatorArguments: BaseValidatorArguments,
    queryOptions: ValidationQueryOptions = {},
  ): Promise<boolean> {
    return this.runQuery(value, validatorArguments, (repository, columnName) =>
      this.queryValueExists(repository, columnName, value, queryOptions),
    );
  }

  /**
   * Checks whether at least one of the values exists, using one `IN` query per chunk of values.
   *
   * @param values - The values to query
   * @param validatorArguments - Validator arguments
   * @param queryOptions - Query options
   * @returns Promise resolving to true if at least one value exists, false otherwise
   * @throws {ValidationQueryError} if database query fails
   *
   * @protected
   */
  protected async anyValueExists(
    values: readonly unknown[],
    validatorArguments: BaseValidatorArguments,
    queryOptions: ValidationQueryOptions = {},
  ): Promise<boolean> {
    return this.runQuery(
      values,
      validatorArguments,
      async (repository, columnName) => {
        for (const chunk of chunkDistinctValues(values)) {
          const result = await this.createQuery(repository, queryOptions)
            .select('1')
            .where(`${QUERY_ALIAS}.${columnName} IN (:...values)`, {
              values: chunk,
            })
            .take(1)
            .getRawOne<Record<string, unknown>>();

          if (isPresent(result)) {
            return true;
          }
        }

        return false;
      },
    );
  }

  /**
   * Checks whether every value exists, using one `IN` query per chunk of values.
   *
   * Values that are not found by an exact comparison with the returned column values
   * (for example because of a case-insensitive collation or a different value type)
   * are checked again one by one, so the result always follows the database comparison rules.
   *
   * @param values - The values to query
   * @param validatorArguments - Validator arguments
   * @param queryOptions - Query options
   * @returns Promise resolving to true if every value exists, false otherwise
   * @throws {ValidationQueryError} if database query fails
   *
   * @protected
   */
  protected async allValuesExist(
    values: readonly unknown[],
    validatorArguments: BaseValidatorArguments,
    queryOptions: ValidationQueryOptions = {},
  ): Promise<boolean> {
    return this.runQuery(
      values,
      validatorArguments,
      async (repository, columnName) => {
        const unmatchedValues: unknown[] = [];

        for (const chunk of chunkDistinctValues(values)) {
          const rows = await this.createQuery(repository, queryOptions)
            .select(`${QUERY_ALIAS}.${columnName}`, 'value')
            .distinct(true)
            .where(`${QUERY_ALIAS}.${columnName} IN (:...values)`, {
              values: chunk,
            })
            .getRawMany<{ value: unknown }>();

          const foundValues = new Set(rows.map((row) => String(row.value)));
          unmatchedValues.push(
            ...chunk.filter((value) => !foundValues.has(String(value))),
          );
        }

        for (const value of unmatchedValues) {
          const exists = await this.queryValueExists(
            repository,
            columnName,
            value,
            queryOptions,
          );

          if (!exists) {
            return false;
          }
        }

        return true;
      },
    );
  }

  /**
   * Extracts the entity name from entity target or table name string.
   *
   * @param entityOrTableName - Entity class or table name
   * @returns The entity name
   *
   * @protected
   */
  protected getEntityName(
    entityOrTableName: EntityTarget<ObjectLiteral> | string,
  ): string {
    return typeof entityOrTableName === 'string'
      ? entityOrTableName
      : (entityOrTableName as { name?: string }).name || 'entity';
  }

  /**
   * Resolves the repository for the configured data source and runs a query,
   * converting failures into validator errors.
   *
   * @param value - The validated value, reported in the error context
   * @param validatorArguments - Validator arguments
   * @param query - The query to run
   * @returns The query result
   * @throws {ValidationConfigurationError} if the entity has no TypeORM metadata
   * @throws {ValidationQueryError} if database query fails
   */
  private async runQuery<T>(
    value: unknown,
    validatorArguments: BaseValidatorArguments,
    query: (
      repository: Repository<ObjectLiteral>,
      columnName: string,
    ) => Promise<T>,
  ): Promise<T> {
    const [entityOrTableName, columnName, dataSourceName] =
      validatorArguments.constraints;

    try {
      const dataSource: DataSource = await getDataSourceForValidation(
        typeof dataSourceName === 'string' ? dataSourceName : undefined,
      );

      const repository: Repository<ObjectLiteral> = dataSource.getRepository(
        entityOrTableName ?? '',
      );

      return await query(repository, columnName);
    } catch (error) {
      if (error instanceof ValidatorError) {
        throw error;
      }

      const originalError = toError(error);
      const entityName = this.getEntityName(entityOrTableName);

      if (originalError.name === 'EntityMetadataNotFoundError') {
        throw new ValidationConfigurationError(
          `No TypeORM metadata found for "${entityName}". Ensure the entity is registered in the entities of the DataSource used for validation.`,
          {
            property: validatorArguments.property,
            constraints: validatorArguments.constraints,
          },
          originalError,
        );
      }

      throw new ValidationQueryError(
        `Failed to validate in ${entityName}.${columnName}`,
        originalError,
        {
          property: validatorArguments.property,
          value,
          entity: entityName,
          columnName: columnName,
        },
      );
    }
  }

  /**
   * Creates the base query builder, including soft-deleted rows when requested.
   */
  private createQuery(
    repository: Repository<ObjectLiteral>,
    queryOptions: ValidationQueryOptions,
  ): SelectQueryBuilder<ObjectLiteral> {
    const queryBuilder = repository.createQueryBuilder(QUERY_ALIAS);

    return queryOptions.withDeleted === true
      ? queryBuilder.withDeleted()
      : queryBuilder;
  }

  /**
   * Runs the single value existence query.
   */
  private async queryValueExists(
    repository: Repository<ObjectLiteral>,
    columnName: string,
    value: unknown,
    queryOptions: ValidationQueryOptions,
  ): Promise<boolean> {
    const result = await this.createQuery(repository, queryOptions)
      .select('1')
      .where(`${QUERY_ALIAS}.${columnName} = :value`, {
        value: value,
      })
      .take(1)
      .getRawOne<Record<string, unknown>>();

    return isPresent(result);
  }
}

/**
 * Removes exact duplicates and splits the values into chunks that fit in an `IN` clause on every supported database.
 */
function chunkDistinctValues(values: readonly unknown[]): unknown[][] {
  const distinctValues = Array.from(new Set(values));
  const chunks: unknown[][] = [];

  for (
    let index = 0;
    index < distinctValues.length;
    index += IN_CLAUSE_CHUNK_SIZE
  ) {
    chunks.push(distinctValues.slice(index, index + IN_CLAUSE_CHUNK_SIZE));
  }

  return chunks;
}

/**
 * Whether a raw query returned a row.
 */
function isPresent(result: Record<string, unknown> | null | undefined) {
  return result !== null && result !== undefined;
}
