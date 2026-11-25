import type { ValidationArguments } from 'class-validator';
import type { EntityTarget, ObjectLiteral } from 'typeorm';

import type { ValidationQueryOptions } from '@/types/validation-query-options.type';

/**
 * Extended validation arguments.
 *
 * @interface BaseValidatorArguments
 * @extends {ValidationArguments}
 */
export interface BaseValidatorArguments extends ValidationArguments {
  /** Tuple containing the entity/table name, column name, optional data source name, `each` flag and query options */
  constraints: [
    entityOrTableName: EntityTarget<ObjectLiteral> | string,
    columnName: string,
    dataSource?: string | null,
    each?: boolean,
    queryOptions?: ValidationQueryOptions,
  ];
}
