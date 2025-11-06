import { ValidatorError } from '@/errors';

/**
 * Error thrown when data source is invalid.
 *
 * @public
 */
export class DataSourceInvalidError extends ValidatorError {
  constructor(cause?: Error) {
    super(`Invalid DataSource instance provided`, cause);
  }
}
