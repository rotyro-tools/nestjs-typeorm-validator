import type { DataSource } from 'typeorm';

import {
  DataSourceInitializationError,
  DataSourceInvalidError,
  DataSourceNotRegisteredError,
} from '@/errors';
import type { DataSourceLike } from '@/types';

const dataSources = new Map<string, DataSourceLike>();
const DEFAULT_DATA_SOURCE_NAME = 'default';

/**
 * Register a DataSource instance to be used for validation.
 * @param dataSourceInstance - TypeORM DataSource instance
 * @param dataSourceName - Optional DataSource name (defaults to 'default'). If `null`, `undefined`, or an empty string is passed,
 *                         the registration will use the 'default' name — the same name used when registering without specifying one.
 * @throws {DataSourceInvalidError} if the instance is invalid
 */
export function registerDataSourceForValidation(
  dataSourceInstance: DataSourceLike,
  dataSourceName?: string,
): void {
  if (
    !dataSourceInstance ||
    typeof dataSourceInstance.getRepository !== 'function'
  ) {
    throw new DataSourceInvalidError();
  }

  const normalizedName = normalizeDataSourceName(dataSourceName);
  dataSources.set(normalizedName, dataSourceInstance);
}

/**
 * Get the registered DataSource for validation.
 * @param dataSourceName - DataSource name (defaults to 'default'). Passing `null`, `undefined`, or an empty string will resolve to 'default'.
 * @returns DataSource instance
 * @throws {DataSourceNotRegisteredError} if DataSource is not registered
 * @throws {DataSourceInitializationError} if DataSource fails to initialize
 */
export async function getDataSourceForValidation(
  dataSourceName?: string,
): Promise<DataSource> {
  const normalizedName = normalizeDataSourceName(dataSourceName);
  const dataSource = dataSources.get(normalizedName);

  if (!dataSource) {
    throw new DataSourceNotRegisteredError(normalizedName);
  }

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  if (!dataSource.isInitialized) {
    throw new DataSourceInitializationError(normalizedName);
  }

  return dataSource as DataSource;
}

/**
 * Clear all registered data sources.
 */
export function clearDataSourcesForValidation(): void {
  dataSources.clear();
}

/**
 * Normalizes and validates the data source name.
 * @param dataSourceName - The data source name to normalize. `null`, `undefined`, or empty string will map to the 'default' name.
 * @returns Normalized data source name
 * @throws {DataSourceInvalidError} if the name is invalid
 */
function normalizeDataSourceName(dataSourceName?: string): string {
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
