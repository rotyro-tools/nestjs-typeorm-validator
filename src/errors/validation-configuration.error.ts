import { ValidatorError } from '@/errors';

/**
 * Error thrown when validation configuration is invalid.
 *
 * @public
 */
export class ValidationConfigurationError extends ValidatorError {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message, cause);
  }
}
