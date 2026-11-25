import { ValidatorError } from '@/errors';

/**
 * Error thrown when a registered data source is not initialized and automatic initialization is disabled.
 *
 * @public
 */
export class DataSourceNotInitializedError extends ValidatorError {
  constructor(dataSourceName: string) {
    super(
      `DataSource "${dataSourceName}" is registered for validation but is not initialized. ` +
        'Register the DataSource your application has already initialized ' +
        '(in NestJS, inject it with @InjectDataSource() and register it in onModuleInit), ' +
        'or pass { autoInitialize: true } to registerDataSourceForValidation().',
    );
  }
}
