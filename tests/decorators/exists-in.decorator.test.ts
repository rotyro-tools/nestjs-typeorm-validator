import {
  type ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

import { ExistsIn } from '@/decorators';

jest.mock('class-validator', () => {
  const registerDecorator = jest.fn();
  const ValidatorConstraint = jest.fn(
    () =>
      ((target: new (...args: unknown[]) => unknown) =>
        target) as ClassDecorator,
  );
    return { registerDecorator, ValidatorConstraint };
});

describe('ExistsIn test suite', () => {
  class Dummy {}

  beforeEach(() => {
    const mockedRegister = registerDecorator as jest.MockedFunction<
      typeof registerDecorator
    >;
    mockedRegister.mockClear();
  });

  test('should call registerDecorator with entity class', () => {
    class TestDto {
      authorId!: number;
    }

    const dec = (ExistsIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'id',
    );
    dec(TestDto.prototype, 'authorId');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'authorId',
        constraints: [Dummy, 'id', undefined, undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });

  test('should call registerDecorator with table name', () => {
    class TestDto {
      authorId!: number;
    }
    const dec = (ExistsIn as (...args: unknown[]) => PropertyDecorator)(
      'user',
      'id',
    );
    dec(TestDto.prototype, 'authorId');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'authorId',
        constraints: ['user', 'id', undefined, undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });

  test('should call registerDecorator with dataSourceName', () => {
    class TestDto {
      authorId!: number;
    }
    const dec = (ExistsIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'id',
      'secondary',
    );
    dec(TestDto.prototype, 'authorId');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'authorId',
        constraints: [Dummy, 'id', 'secondary', undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });

  test('should call registerDecorator with options', () => {
    const options = { message: 'Custom error' };
    class TestDto {
      authorId!: number;
    }
    const dec = (ExistsIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'id',
      undefined,
      options,
    );
    dec(TestDto.prototype, 'authorId');

    expect(registerDecorator).toHaveBeenCalledWith(
      expect.objectContaining({
        target: TestDto,
        propertyName: 'authorId',
        options,
        constraints: [Dummy, 'id', undefined, undefined],
        validator: expect.any(
          Function,
        ) as unknown as new () => ValidatorConstraintInterface,
      }),
    );
  });
});
