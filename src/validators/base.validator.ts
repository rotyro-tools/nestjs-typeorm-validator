import type {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';

import {
  DataSourceInitializationError,
  DataSourceInvalidError,
  DataSourceNotRegisteredError,
  ValidationConfigurationError,
  ValidationQueryError,
} from '@/errors';
import type { BaseValidatorArguments } from '@/types';
import { getDataSourceForValidation } from '@/utils';

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
   * Executes a database query to check for value existence.
   *
   * Returns a tuple: [anyExists, allExists]
   * - anyExists: true if at least one of the provided values exists
   * - allExists: true if all of the provided values exist
   *
   * For single values both flags are identical.
   *
   * @param value - The value to query
   * @param validatorArguments - Validator arguments
   * @returns Promise resolving to [anyExists, allExists]
   * @throws {ValidationQueryError} if database query fails
   *
   * @protected
   */
  protected async valueExists(
    value: unknown,
    validatorArguments: BaseValidatorArguments,
  ): Promise<[boolean, boolean]> {
    const [entityOrTableName, columnName, dataSourceName, each] =
      validatorArguments.constraints;

    try {
      const normalizedDataSourceName =
        dataSourceName &&
        typeof dataSourceName === 'string' &&
        dataSourceName.trim() !== ''
          ? dataSourceName.trim()
          : undefined;

      const dataSource: DataSource = await getDataSourceForValidation(
        normalizedDataSourceName,
      );

      const repository: Repository<ObjectLiteral> =
        typeof entityOrTableName === 'string'
          ? dataSource.getRepository(entityOrTableName)
          : dataSource.getRepository(entityOrTableName ?? '');

      let queryValue: unknown = value;
      if (each && each === true) {
        queryValue = (queryValue as string)
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v !== '');
      }

      // Array-value path
      if (Array.isArray(queryValue)) {
        const values = queryValue as unknown[];
        if (values.length === 0) {
          return [false, false];
        }

        const uniqueValues = Array.from(new Set(values));

        const countResult = await repository
          .createQueryBuilder('entityOrTableName')
          .select(`COUNT(DISTINCT entityOrTableName.${columnName})`, 'cnt')
          .where(`entityOrTableName.${columnName} IN (:...values)`, {
            values: uniqueValues,
          })
          .getRawOne<{ cnt: string | number }>();

        const found =
          (countResult &&
            ('cnt' in countResult ? Number(countResult.cnt) : 0)) ??
          0;

        const anyExists = found > 0;
        const allExists = found === uniqueValues.length;

        return [anyExists, allExists];
      }

      // Single-value path
      const result: { '1': number } | null | undefined = await repository
        .createQueryBuilder('entityOrTableName')
        .select('1')
        .where(`entityOrTableName.${columnName} = :value`, {
          value: queryValue,
        })
        .take(1)
        .getRawOne<{ '1': number }>();

      const exists = result !== null && result !== undefined;
      return [exists, exists];
    } catch (error) {
      if (
        error instanceof ValidationConfigurationError ||
        error instanceof DataSourceNotRegisteredError ||
        error instanceof DataSourceInitializationError ||
        error instanceof DataSourceInvalidError
      ) {
        throw error;
      }
      const errMsg = error instanceof Error ? error.message : String(error);

      if (/no metadata/i.test(errMsg) || /doesn't exist/i.test(errMsg)) {
        const entityName = this.getEntityName(entityOrTableName);
        throw new ValidationConfigurationError(
          `No metadata found for "${entityName}". Ensure it exists and is properly registered in the data source.`,
          {
            property: validatorArguments.property,
            constraints: validatorArguments.constraints,
          },
        );
      }
      const originalError =
        error instanceof Error ? error : new Error(String(error));

      const entityName = this.getEntityName(entityOrTableName);

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
}
