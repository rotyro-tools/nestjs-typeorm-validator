import {
  type ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

import { UniqueIn } from '@/decorators';

jest.mock('class-validator', () => {
  const registerDecorator = jest.fn();
  const ValidatorConstraint = jest.fn(
    () =>
      ((target: new (...args: unknown[]) => unknown) =>
        target) as ClassDecorator,
  );
  return { registerDecorator, ValidatorConstraint };
});

describe('UniqueIn test suite', () => {
  class Dummy {}

  beforeEach(() => {
    const mockedRegister = registerDecorator as jest.MockedFunction<
      typeof registerDecorator
    >;
    mockedRegister.mockClear();
  });

  test('should call registerDecorator with entity class', () => {
    class TestDto {
      email!: string;
    }

    const dec = (UniqueIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'email',
    );
    dec(TestDto.prototype, 'email');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'email',
        constraints: [Dummy, 'email', undefined, undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });

  test('should call registerDecorator with table name', () => {
    class TestDto {
      email!: string;
    }
    const dec = (UniqueIn as (...args: unknown[]) => PropertyDecorator)(
      'user',
      'email',
    );
    dec(TestDto.prototype, 'email');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'email',
        constraints: ['user', 'email', undefined, undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });

  test('should call registerDecorator with dataSourceName', () => {
    class TestDto {
      email!: string;
    }
    const dec = (UniqueIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'email',
      'secondary',
    );
    dec(TestDto.prototype, 'email');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'email',
        constraints: [Dummy, 'email', 'secondary', undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });

  test('should call registerDecorator with options', () => {
    const options = { message: 'Custom error' };
    class TestDto {
      email!: string;
    }
    const dec = (UniqueIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'email',
      undefined,
      options,
    );
    dec(TestDto.prototype, 'email');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'email',
        options,
        constraints: [Dummy, 'email', undefined, undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });
});
