import { ValidatorError } from '@/errors';

/**
 * Error thrown when data source initialization fails.
 *
 * @public
 */
export class DataSourceInitializationError extends ValidatorError {
  constructor(dataSourceName: string, cause?: Error) {
    super(
      `DataSource "${dataSourceName}" is not initialized. Please ensure it's initialized before use.`,
      cause,
    );
  }
}
