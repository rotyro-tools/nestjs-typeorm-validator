import type { ValidationArguments } from 'class-validator';
import type { EntityTarget, ObjectLiteral } from 'typeorm';

/**
 * Extended validation arguments.
 *
 * @interface BaseValidatorArguments
 * @extends {ValidationArguments}
 */
export interface BaseValidatorArguments extends ValidationArguments {
  /** Tuple containing the entity/table name, column name, and optional data source name */
  constraints: [
    entityOrTableName: EntityTarget<ObjectLiteral> | string,
    columnName: string,
    dataSource?: string,
    each?: boolean,
  ];
}
