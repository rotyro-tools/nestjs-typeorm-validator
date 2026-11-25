import { ValidatorError } from '@/errors';

/**
 * Error thrown when a database query fails during validation.
 * The message ends with the message of the underlying database error.
 *
 * @public
 */
export class ValidationQueryError extends ValidatorError {
  constructor(
    message: string,
    cause: Error,
    public readonly context?: Record<string, unknown>,
  ) {
    super(`${message}: ${cause.message}`, cause);
  }
}
