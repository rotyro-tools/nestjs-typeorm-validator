import { ValidatorError } from '@/errors';

describe('ValidatorError test suite', () => {
  test('concatenates cause stack when cause has a stack', () => {
    const cause = new Error('root-cause');
    const VErr = ValidatorError as unknown as new (
      message?: string,
      cause?: Error,
    ) => Error;
    const e = new VErr('vErr', cause);
    expect(e.stack).toBeDefined();
    expect(typeof e.stack === 'string' && e.stack.includes('Caused by:')).toBe(
      true,
    );
  });

  test('works when Error.captureStackTrace is not available', () => {
    const errorCtor = Error as unknown as {
      captureStackTrace?: (
        target: object,
        ctor?: new (...args: unknown[]) => unknown,
      ) => void;
    };
    const original = errorCtor.captureStackTrace;
    try {
      errorCtor.captureStackTrace = undefined;
      const VErr = ValidatorError as unknown as new (
        message?: string,
        cause?: Error,
      ) => Error;
      const e = new VErr('vErr');
      expect(e).toBeInstanceOf(Error);
    } finally {
      errorCtor.captureStackTrace = original;
    }
  });
});
