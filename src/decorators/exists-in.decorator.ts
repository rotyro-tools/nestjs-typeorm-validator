import { type ValidationOptions, registerDecorator } from 'class-validator';
import type { EntityTarget } from 'typeorm';

import { ExistsInValidator } from '@/validators';

/**
 * Validates that the decorated property's value **exists in** a specific database column.
 *
 * @description
 * The `@ExistsIn` decorator performs a database lookup (via TypeORM) to verify that the
 * provided value **exists** in the specified table column.
 * It supports both:
 * - **Entity classes** (e.g., `User`, `Post`)
 * - **Table name strings** (e.g., `'user'`, `'post'`). A string must match the name or table name of an entity
 *   registered in the DataSource; it is not raw table access.
 *
 *
 * You can also specify which registered data source to use by passing the dataSourceName
 * (the same name you used when calling `registerDataSourceForValidation(dataSourceInstance, 'yourName')`).
 * If you pass `null` or `undefined` (or leave the parameter omitted), the decorator will use the
 * 'default' data source — the same default used when registering a data source without specifying a name.
 *
 * The `validationOptions` parameter accepts the same ValidationOptions used by `class-validator`
 * (for example `message` for a custom error message).
 * With `each: true`, the values of an array, Set or Map are checked together in batched `IN` queries
 * (one query per 500 distinct values) instead of one query per value. The validation fails if any value
 * is `null`/`undefined` or does not exist. Soft-deleted rows are treated as non-existent.
 *
 * @example
 * **Using with an Entity class:**
 * ```typescript
 * class CreatePostDto {
 *   @ExistsIn(User, 'id')
 *   authorId: number;
 * }
 * ```
 *
 * @example
 * **Using with a table name:**
 * ```typescript
 * class CreatePostDto {
 *   @ExistsIn('user', 'id')
 *   authorId: number;
 * }
 * ```
 *
 * @example
 * **Using with a specific data source (registered as 'secondary'):**
 * ```typescript
 * class CreatePostDto {
 *   @ExistsIn(User, 'id', 'secondary')
 *   authorId: number;
 * }
 * ```
 *
 * @example
 * **Using a default data source and validating arrays with custom message:**
 * ```typescript
 * class CreateMultiplePostsDto {
 *   @ExistsIn('user', 'id', null, { each: true, message: 'Every authorId must exist' })
 *   authorIds: number[];
 * }
 * ```
 *
 * @param entityOrTableName - The entity class or table name to check against.
 * @param columnName - The column name in which to look for the value.
 * @param dataSourceName - Optional name of the data source to use for validation (must match a registered name).
 *                         Passing `null`/`undefined` (or omitting this argument) will use the 'default' data source.
 * @param validationOptions - Optional validation settings from `class-validator` (use `{ each: true }` for arrays and `message` for custom text).
 * @returns A property decorator function used by `class-validator`.
 *
 * @public
 */
export function ExistsIn<T extends EntityTarget<unknown> | string>(
  entityOrTableName: T,
  columnName: T extends string
    ? string
    : T extends EntityTarget<infer E>
      ? keyof E & string
      : string,
  dataSourceName?: string | null,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  const { each, ...options } = validationOptions ?? {};

  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [
        entityOrTableName,
        columnName,
        dataSourceName,
        each === true,
      ] as const,
      validator: ExistsInValidator,
    });
  };
}
