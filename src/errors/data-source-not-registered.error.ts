import { ValidatorError } from '@/errors';

/**
 * Error thrown when data source is not registered.
 *
 * @public
 */
export class DataSourceNotRegisteredError extends ValidatorError {
  constructor(dataSourceName: string = 'default') {
    super(
      `DataSource "${dataSourceName}" is not registered. Please call registerDataSourceForValidation() first.`,
    );
  }
}
