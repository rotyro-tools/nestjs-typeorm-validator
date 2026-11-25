import { registerDecorator } from 'class-validator';

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
        constraints: [Dummy, 'email', undefined, false, { withDeleted: true }],
        validator: expect.any(Function) as unknown,
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
        constraints: ['user', 'email', undefined, false, { withDeleted: true }],
        validator: expect.any(Function) as unknown,
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
        constraints: [
          Dummy,
          'email',
          'secondary',
          false,
          { withDeleted: true },
        ],
        validator: expect.any(Function) as unknown,
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
        constraints: [Dummy, 'email', undefined, false, { withDeleted: true }],
        validator: expect.any(Function) as unknown,
      }),
    );
  });

  test('should pass each and includeSoftDeleted as constraints instead of class-validator options', () => {
    class TestDto {
      emails!: string[];
    }
    const dec = (UniqueIn as (...args: unknown[]) => PropertyDecorator)(
      Dummy,
      'email',
      null,
      { each: true, includeSoftDeleted: false, message: 'Taken' },
    );
    dec(TestDto.prototype, 'emails');

    expect(registerDecorator).toHaveBeenCalledWith({
      target: TestDto,
      propertyName: 'emails',
      options: { message: 'Taken' },
      constraints: [Dummy, 'email', null, true, { withDeleted: false }],
      validator: expect.any(Function) as unknown,
    });
  });
});
