import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import type { BaseValidatorArguments } from '@/types';
import { BaseValidator } from '@/validators';

/**
 * Validator that checks if a value exists in a database table column.
 *
 * @description
 * This validator performs an asynchronous database query to verify the existence
 * of a value in the specified column. Used internally by the ExistsIn decorator.
 *
 * @public
 */
@ValidatorConstraint({ name: 'ExistsIn', async: true })
export class ExistsInValidator
  extends BaseValidator
  implements ValidatorConstraintInterface
{
  /**
   * Validates that the value exists in the specified database column.
   *
   * @param value - The value to validate
   * @param validatorArguments - Validation arguments containing entity/table and column information
   * @returns Promise resolving to true if the value exists, false otherwise
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
      return false;
    }

    this.validateConstraints(validatorArguments, 'ExistsIn');

    const exists = await this.valueExists(value, validatorArguments);

    return exists;
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
      return `${propertyName} with values [${validatorArguments.value}] do not all exist in ${entityName}.${columnName}`;
    }

    return `${propertyName} with value "${validatorArguments.value}" does not exist in ${entityName}.${columnName}`;
  }
}
