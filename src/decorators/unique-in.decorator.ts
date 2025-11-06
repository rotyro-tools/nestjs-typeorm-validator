import { type ValidationOptions, registerDecorator } from 'class-validator';
import type { EntityTarget } from 'typeorm';

import { UniqueInValidator } from '@/validators';

/**
 * Validates that the decorated property's value is **unique** within a specified database column.
 *
 * @description
 * The `@UniqueIn` decorator performs a database lookup (via TypeORM) to ensure that the provided
 * value does **not already exist** in the specified table column.
 * It supports both:
 * - **Entity class references** (e.g., `User`, `Post`)
 * - **Direct table name strings** (e.g., `'user'`, `'post'`)
 *
 *
 * You can also specify which registered data source to use by passing the dataSourceName
 * (the same name you used when calling `registerDataSourceForValidation(dataSourceInstance, 'yourName')`).
 * If you pass `null` or `undefined` (or leave the parameter omitted), the decorator will use the
 * 'default' data source — the same default used when registering a data source without specifying a name.
 *
 * The `validationOptions` parameter accepts the same ValidationOptions used by `class-validator`.
 * Therefore options such as `each: true` (to validate array elements) and `message` (to provide a custom error message)
 * behave exactly as they do in `class-validator`.
 *
 * @example
 * **Using with an Entity class:**
 * ```typescript
 * class CreateUserDto {
 *   @UniqueIn(User, 'email')
 *   email: string;
 * }
 * ```
 *
 * @example
 * **Using with a table name:**
 * ```typescript
 * class CreateUserDto {
 *   @UniqueIn('user', 'email')
 *   email: string;
 * }
 * ```
 *
 * @example
 * **Using with a specific data source (registered as 'secondary'):**
 * ```typescript
 * class CreateUserDto {
 *   @UniqueIn(User, 'email', 'secondary')
 *   email: string;
 * }
 * ```
 *
 * @example
 * **Using a default data source and validating arrays with custom message:**
 * ```typescript
 * class CreateUsersDto {
 *   @UniqueIn('user', 'email', null, { each: true, message: 'Each user email must be unique' })
 *   emails: string[];
 * }
 * ```
 *
 * @param entityOrTableName - The entity class or table name to check against.
 * @param columnName - The column name to validate uniqueness in.
 * @param dataSourceName - Optional name of the data source to use for validation (must match a registered name).
 *                         Passing `null`/`undefined` (or omitting this argument) will use the 'default' data source.
 * @param validationOptions - Optional validation settings from `class-validator` (use `{ each: true }` for arrays and `message` for custom text).
 * @returns A property decorator function used by `class-validator`.
 *
 * @public
 */
export function UniqueIn<T extends EntityTarget<unknown> | string>(
  entityOrTableName: T,
  columnName: T extends string
    ? string
    : T extends EntityTarget<infer E>
      ? keyof E & string
      : string,
  dataSourceName?: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [
        entityOrTableName,
        columnName,
        dataSourceName,
        validationOptions?.each,
      ] as const,
      validator: UniqueInValidator,
    });
  };
}
