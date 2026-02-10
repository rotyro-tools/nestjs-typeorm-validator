import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import type { BaseValidatorArguments } from '@/types';
import { BaseValidator } from '@/validators';

/**
 * Validator that checks if a value is unique in a database table column.
 *
 * @description
 * This validator performs an asynchronous database query to verify the uniqueness
 * of a value in the specified column. Used internally by the UniqueIn decorator.
 *
 * @public
 */
@ValidatorConstraint({ name: 'UniqueIn', async: true })
export class UniqueInValidator
  extends BaseValidator
  implements ValidatorConstraintInterface
{
  /**
   * Validates that the value is unique in the specified database column.
   *
   * @param value - The value to validate
   * @param validatorArguments - Validation arguments containing entity/table and column information
   * @returns Promise resolving to true if the value is unique, false otherwise
   * @throws {ValidationConfigurationError} if configuration is invalid
   * @throws {ValidationQueryError} if database query fails
   *
   * @public
   */
  async validate(
    value: unknown,
    validatorArguments: BaseValidatorArguments,
  ): Promise<boolean> {
    if (value === null || value === undefined) {
      return true;
    }

    this.validateConstraints(validatorArguments, 'UniqueIn');

    const exists = await this.valueExists(value, validatorArguments);
    return !exists;
  }

  /**
   * Generates the default error message when validation fails.
   *
   * @param validatorArguments - Validation arguments containing column information
   * @returns The formatted error message
   *
   * @public
   */
  defaultMessage(validatorArguments: BaseValidatorArguments): string {
    const [entityOrTableName, columnName, _dataSourceName, each] =
      validatorArguments.constraints;
    const propertyName = validatorArguments.property;
    const entityName = this.getEntityName(entityOrTableName);

    if (each && each === true) {
      return `${propertyName} with values [${validatorArguments.value}] are not all unique in ${entityName}.${columnName}`;
    }

    return `${propertyName} with value "${validatorArguments.value}" is not unique in ${entityName}.${columnName}`;
  }
}
