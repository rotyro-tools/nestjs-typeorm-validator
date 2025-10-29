/**
 * Interface representing the minimal DataSource contract needed for validation.
 * This allows compatibility with different TypeORM versions.
 */
export interface DataSourceLike {
  isInitialized: boolean;
  initialize(): Promise<this>;
  getRepository(
    target: string | (new (...args: unknown[]) => unknown),
  ): unknown;
}
