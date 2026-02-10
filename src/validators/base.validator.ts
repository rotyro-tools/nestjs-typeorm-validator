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
   * Returns true if the value exists.
   *
   * @param value - The value to query
   * @param validatorArguments - Validator arguments
   * @returns Promise resolving to true if value exists, false otherwise
   * @throws {ValidationQueryError} if database query fails
   *
   * @protected
   */
  protected async valueExists(
    value: unknown,
    validatorArguments: BaseValidatorArguments,
  ): Promise<boolean> {
    const [entityOrTableName, columnName, dataSourceName] =
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

      const result: { '1': number } | null | undefined = await repository
        .createQueryBuilder('entityOrTableName')
        .select('1')
        .where(`entityOrTableName.${columnName} = :value`, {
          value: value,
        })
        .take(1)
        .getRawOne<{ '1': number }>();

      const exists = result !== null && result !== undefined;
      return exists;
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
