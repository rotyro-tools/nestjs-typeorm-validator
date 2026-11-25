import type { DataSource } from 'typeorm';

import {
  DataSourceInitializationError,
  DataSourceInvalidError,
  DataSourceNotInitializedError,
  DataSourceNotRegisteredError,
} from '@/errors';
import type { DataSourceLike, RegisterDataSourceOptions } from '@/types';
import { toError } from '@/utils/to-error.util';

interface DataSourceRegistration {
  dataSource: DataSourceLike;
  autoInitialize: boolean;
  initialization?: Promise<void>;
}

const registrations = new Map<string, DataSourceRegistration>();
const DEFAULT_DATA_SOURCE_NAME = 'default';

/**
 * Register a DataSource instance to be used for validation.
 *
 * Register the DataSource your application has already initialized (in NestJS, the one injected with
 * `@InjectDataSource()`), so that validations reuse its connection pool. The validators never initialize
 * a DataSource unless `options.autoInitialize` is `true`.
 * Registering again under the same name replaces the previous registration.
 *
 * @param dataSourceInstance - TypeORM DataSource instance
 * @param dataSourceName - Optional DataSource name (defaults to 'default'). If `null`, `undefined`, or an empty string is passed,
 *                         the registration will use the 'default' name — the same name used when registering without specifying one.
 * @param options - Registration options
 * @throws {DataSourceInvalidError} if the instance or the name is invalid
 */
export function registerDataSourceForValidation(
  dataSourceInstance: DataSourceLike,
  dataSourceName?: string | null,
  options: RegisterDataSourceOptions = {},
): void {
  if (
    !dataSourceInstance ||
    typeof dataSourceInstance.getRepository !== 'function'
  ) {
    throw new DataSourceInvalidError();
  }

  const normalizedName = normalizeDataSourceName(dataSourceName);
  registrations.set(normalizedName, {
    dataSource: dataSourceInstance,
    autoInitialize: options.autoInitialize === true,
  });
}

/**
 * Get the registered DataSource for validation.
 *
 * When the DataSource is not initialized, it is initialized only if it was registered with
 * `autoInitialize: true`. Concurrent calls share a single initialization, and a failed
 * initialization is retried on the next call.
 *
 * @param dataSourceName - DataSource name (defaults to 'default'). Passing `null`, `undefined`, or an empty string will resolve to 'default'.
 * @returns DataSource instance
 * @throws {DataSourceNotRegisteredError} if DataSource is not registered
 * @throws {DataSourceNotInitializedError} if DataSource is not initialized and automatic initialization is disabled
 * @throws {DataSourceInitializationError} if automatic initialization fails
 */
export async function getDataSourceForValidation(
  dataSourceName?: string | null,
): Promise<DataSource> {
  const normalizedName = normalizeDataSourceName(dataSourceName);
  const registration = registrations.get(normalizedName);

  if (!registration) {
    throw new DataSourceNotRegisteredError(normalizedName);
  }

  if (!registration.dataSource.isInitialized) {
    if (!registration.autoInitialize) {
      throw new DataSourceNotInitializedError(normalizedName);
    }

    if (!registration.initialization) {
      registration.initialization = initializeRegistration(
        registration,
        normalizedName,
      ).finally(() => {
        registration.initialization = undefined;
      });
    }

    await registration.initialization;
  }

  return registration.dataSource as DataSource;
}

/**
 * Clear all registered data sources.
 */
export function clearDataSourcesForValidation(): void {
  registrations.clear();
}

/**
 * Initializes a registered DataSource.
 * @param registration - The registration holding the DataSource
 * @param dataSourceName - The normalized registration name, used in error messages
 * @throws {DataSourceInitializationError} if the DataSource is still not initialized afterwards
 */
async function initializeRegistration(
  registration: DataSourceRegistration,
  dataSourceName: string,
): Promise<void> {
  try {
    await registration.dataSource.initialize();
  } catch (error) {
    if (registration.dataSource.isInitialized) {
      return;
    }
    throw new DataSourceInitializationError(dataSourceName, toError(error));
  }

  if (!registration.dataSource.isInitialized) {
    throw new DataSourceInitializationError(dataSourceName);
  }
}

/**
 * Normalizes and validates the data source name.
 * @param dataSourceName - The data source name to normalize. `null`, `undefined`, or empty string will map to the 'default' name.
 * @returns Normalized data source name
 * @throws {DataSourceInvalidError} if the name is invalid
 */
function normalizeDataSourceName(dataSourceName?: string | null): string {
  if (dataSourceName === null || dataSourceName === undefined) {
    return DEFAULT_DATA_SOURCE_NAME;
  }

  if (typeof dataSourceName !== 'string') {
    throw new DataSourceInvalidError();
  }

  const trimmed = dataSourceName.trim();

  if (trimmed === '') {
    return DEFAULT_DATA_SOURCE_NAME;
  }

  return trimmed;
}
