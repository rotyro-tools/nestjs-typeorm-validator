/**
 * Options applied to the queries run by the validators.
 *
 * @public
 */
export interface ValidationQueryOptions {
  /** Include soft-deleted rows (entities with a `@DeleteDateColumn`). */
  withDeleted?: boolean;
}
