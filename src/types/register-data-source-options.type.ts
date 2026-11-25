/**
 * Options accepted by `registerDataSourceForValidation`.
 *
 * @public
 */
export interface RegisterDataSourceOptions {
  /**
   * When `true`, the validators initialize the DataSource on first use if it is not initialized yet.
   * Concurrent validations share a single initialization.
   *
   * Disabled by default: register the DataSource your application already initialized instead.
   * Initializing from a validator opens a second connection pool and applies the DataSource options
   * (`migrationsRun`, `synchronize`, ...) from inside a validation call.
   *
   * @defaultValue false
   */
  autoInitialize?: boolean;
}
