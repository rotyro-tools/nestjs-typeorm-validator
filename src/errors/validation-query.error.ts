import { ValidatorError } from '@/errors';

/**
 * Error thrown when a database query fails during validation.
 *
 * @public
 */
export class ValidationQueryError extends ValidatorError {
  constructor(
    message: string,
    cause: Error,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message, cause);
  }
}
