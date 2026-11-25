import type { ValidationOptions } from 'class-validator';

/**
 * Validation options accepted by `@UniqueIn`.
 *
 * @public
 */
export interface UniqueInValidationOptions extends ValidationOptions {
  /**
   * Count soft-deleted rows (entities with a `@DeleteDateColumn`) as taken values.
   * Keep the default when the database unique index also covers soft-deleted rows.
   * Set to `false` when soft-deleted values may be reused (for example a unique index on `(column, deleted_at)`).
   *
   * @defaultValue true
   */
  includeSoftDeleted?: boolean;
}
