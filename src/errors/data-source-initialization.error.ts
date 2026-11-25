import { ValidatorError } from '@/errors';

/**
 * Error thrown when the automatic initialization of a data source fails.
 *
 * @public
 */
export class DataSourceInitializationError extends ValidatorError {
  constructor(dataSourceName: string, cause?: Error) {
    super(
      `Failed to initialize DataSource "${dataSourceName}" for validation${cause ? `: ${cause.message}` : ''}`,
      cause,
    );
  }
}
