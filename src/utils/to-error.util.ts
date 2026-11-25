/**
 * Converts an unknown thrown value into an Error instance.
 * @param error - The thrown value
 * @returns The value itself when it is an Error, otherwise a new Error built from its string form
 */
export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
