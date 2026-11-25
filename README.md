# NestJS TypeORM Validator

[![Publish to npm](https://github.com/rotyro-tools/nestjs-typeorm-validator/actions/workflows/publish-to-npm.yml/badge.svg)](https://github.com/rotyro-tools/nestjs-typeorm-validator/actions/workflows/publish-to-npm.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/rotyro-tools/nestjs-typeorm-validator)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Lightweight NestJS decorators for validating values against TypeORM entities.

This package provides several decorators (more to come):

| Decorator   | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| `@ExistsIn` | Ensures a value exists in a specified entity/table column.    |
| `@UniqueIn` | Ensures a value is unique in a specified entity/table column. |

It integrates with TypeORM DataSource instances, enabling database-aware validation in DTOs.

---

## Key features

- Works with TypeORM entity classes or entity/table name strings.
- Supports multiple (named) TypeORM DataSource registrations.
- Reuses your application's connection pool: validators never open connections on their own (unless you opt in).
- Validates arrays, Sets and Maps (`each: true`) with batched queries instead of one query per value.
- Soft-delete aware: `@ExistsIn` ignores soft-deleted rows, `@UniqueIn` counts them as taken (configurable).
- Supports class-validator options (for example `message` for a custom message).
- Error messages include the underlying database error.
- Minimal runtime dependency surface — relies on TypeORM and class-validator as peer dependencies.

---

## Installation

Install the package:

### npm

```bash
npm install @rotyro-tools/nestjs-typeorm-validator
```

### yarn

```bash
yarn add @rotyro-tools/nestjs-typeorm-validator
```

### pnpm

```bash
pnpm add @rotyro-tools/nestjs-typeorm-validator
```

### bun

```bash
bun add @rotyro-tools/nestjs-typeorm-validator
```

---

## Peer dependencies

This package declares the following peer dependencies that consumers must install at compatible versions:

- [class-validator](https://github.com/typestack/class-validator) (`^0.14.0 || ^0.15.0`)
- [typeorm](https://github.com/typeorm/typeorm) (`^0.3.0 || ^1.0.0`)

Install them:

### npm

```bash
npm install --save class-validator typeorm
```

### yarn

```bash
yarn add class-validator typeorm
```

### pnpm

```bash
pnpm add class-validator typeorm
```

### bun

```bash
bun add class-validator typeorm
```

---

## Getting started

### 1. Register the DataSource your application already uses

The validators run their queries through a DataSource you register with `registerDataSourceForValidation`.
**Register the DataSource your application has already initialized**, so validations share its connection pool.

#### NestJS (recommended)

`TypeOrmModule` creates and initializes its own DataSource. Inject that instance and register it once the module is initialized:

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { registerDataSourceForValidation } from '@rotyro-tools/nestjs-typeorm-validator';
import { DataSource } from 'typeorm';

@Module({
  imports: [TypeOrmModule.forRoot({/* ... */})],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit() {
    registerDataSourceForValidation(this.dataSource); // Registers as 'default'
  }
}
```

With a named connection (`TypeOrmModule.forRoot({ name: 'main', ... })`), inject and register it under a name, then pass that name to the decorators:

```typescript
export class AppModule implements OnModuleInit {
  constructor(
    @InjectDataSource('main') private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    registerDataSourceForValidation(this.dataSource, 'main');
  }
}
```

> **Do not register a separate `new DataSource(options)` instance** (for example one exported from a config file for the TypeORM CLI).
> NestJS never initializes that instance, so validations would throw `DataSourceNotInitializedError`.

#### Plain TypeORM

```typescript
import { registerDataSourceForValidation } from '@rotyro-tools/nestjs-typeorm-validator';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'user',
  password: 'pass',
  database: 'db',
  entities: [/* ... */],
  synchronize: false,
});

await dataSource.initialize();

registerDataSourceForValidation(dataSource); // Registers as 'default'

// A second, named DataSource
const replicaDataSource = new DataSource({/* ... */});
await replicaDataSource.initialize();
registerDataSourceForValidation(replicaDataSource, 'replica');
```

Registering again under the same name replaces the previous registration.

### 2. Use decorators in your DTOs

```typescript
import { ExistsIn, UniqueIn } from '@rotyro-tools/nestjs-typeorm-validator';

import { User } from '@/modules/users/entities/user.entity';

class CreatePostDto {
  // Ensure the given authorId exists in the User entity's id column
  // in the 'default' DataSource
  @ExistsIn(User, 'id', null, { message: 'Author not found' })
  authorId: number;

  // Ensure the title is unique in the post table (using a table name)
  // in the 'replica' DataSource
  @UniqueIn('post', 'title', 'replica', { message: 'Title already taken' })
  title: string;
}
```

---

## Connections and initialization

The validators **never initialize a DataSource on their own** by default. If the registered DataSource is not initialized when a validation runs, the validation throws `DataSourceNotInitializedError` with instructions, instead of silently connecting.

Why: initializing from inside a validator opens a **second connection pool** next to your application's, and applies every option of that DataSource from inside a request (`migrationsRun`, `synchronize`, ...). In versions before 2.0, several validations starting at the same time (for example `each: true` on an array) could each start their own initialization, each opening a pool that was never closed, until the database refused new connections.

### Opting in: `autoInitialize`

For scripts, tests or standalone setups where nothing else initializes the DataSource, you can let the validators initialize it on first use:

```typescript
registerDataSourceForValidation(dataSource, 'default', {
  autoInitialize: true,
});
```

- Concurrent validations share **a single initialization**.
- If the initialization fails, the validation throws `DataSourceInitializationError` (with the cause), and the next validation tries again.
- If the DataSource is destroyed later, the next validation initializes it again.
- Do not enable it for a DataSource your application initializes itself, and keep in mind that the DataSource options (`migrationsRun`, `synchronize`, ...) apply when it initializes.

---

## Validating arrays, Sets and Maps (`each: true`)

```typescript
import { ExistsIn, UniqueIn } from '@rotyro-tools/nestjs-typeorm-validator';

import { Tag } from '@/modules/tags/entities/tag.entity';
import { User } from '@/modules/users/entities/user.entity';

class BulkDto {
  @ExistsIn(Tag, 'name', null, { each: true, message: 'Unknown tag' })
  tagNames: string[];

  @UniqueIn(User, 'email', null, { each: true })
  emails: string[];
}
```

With `each: true`, the values of an array, a Set or a Map (its values) are checked **together**: one `IN (...)` query per 500 distinct values, instead of one query per value. A value given as a single non-collection value is validated as a single value.

| Decorator   | Passes when                                                 | `null` / `undefined` values | Empty collection |
| ----------- | ----------------------------------------------------------- | --------------------------- | ---------------- |
| `@ExistsIn` | every value exists                                          | fail the validation         | passes           |
| `@UniqueIn` | no value exists, and the collection has no exact duplicates | are ignored                 | passes           |

`@ExistsIn` keeps the database comparison rules: a value that the batched query found only through a case-insensitive collation or a type conversion (for example `'ABC'` matching `'abc'`) is checked again on its own, so the result is the same as validating each value separately.

For `@UniqueIn`, duplicates inside the collection are detected with an exact comparison (`'A@x.com'` and `'a@x.com'` are different there, even if the column collation is case-insensitive).

---

## Soft-deleted rows

For entities with a `@DeleteDateColumn`:

- `@ExistsIn` treats soft-deleted rows as **non-existent**.
- `@UniqueIn` counts soft-deleted rows as **taken**, like a database unique index does. When soft-deleted values may be reused (for example with a unique index on `(email, deleted_at)`), pass `includeSoftDeleted: false`:

```typescript
class RegisterUserDto {
  @UniqueIn(User, 'email', null, { includeSoftDeleted: false })
  email: string;
}
```

---

## Entity classes and table names

The first decorator argument is an entity class or a string. A string must match the **entity name or table name of an entity registered in the DataSource**: the validators always go through TypeORM's metadata, they do not query arbitrary tables. The column name is the entity property name (or the column name when using a string).

---

## Errors

Configuration and database problems are **thrown**, not reported as validation failures: an unavailable database does not mean the input is invalid. In NestJS, the `ValidationPipe` lets these errors through to your exception filters (an HTTP 500 by default).

| Error                           | Thrown when                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DataSourceNotRegisteredError`  | no DataSource is registered under the requested name                                                                                    |
| `DataSourceNotInitializedError` | the registered DataSource is not initialized and `autoInitialize` is not enabled                                                        |
| `DataSourceInitializationError` | `autoInitialize` is enabled and the initialization failed (the message ends with the cause)                                             |
| `DataSourceInvalidError`        | `registerDataSourceForValidation` received something that is not a DataSource, or an invalid name                                       |
| `ValidationConfigurationError`  | the decorator is missing the entity or column, or the entity has no TypeORM metadata in that DataSource                                 |
| `ValidationQueryError`          | the query failed (connection refused, too many connections, missing table, unknown column...); the message ends with the database error |

All of them extend `ValidatorError`, are exported by the package, and keep the original error in `cause`:

```typescript
import { ValidationQueryError } from '@rotyro-tools/nestjs-typeorm-validator';

if (error instanceof ValidationQueryError) {
  // error.message: 'Failed to validate in Company.uuid: Too many connections'
  // error.cause: the original database error
}
```

---

## Examples

Checking existence (minimal setup):

```typescript
import { ExistsIn } from '@rotyro-tools/nestjs-typeorm-validator';

class CreateCommentDto {
  @ExistsIn('user', 'id')
  userId: number;
}
```

Unique constraint (entity usage and custom message):

```typescript
import { UniqueIn } from '@rotyro-tools/nestjs-typeorm-validator';

import { User } from '@/modules/users/entities/user.entity';

class RegisterUserDto {
  @UniqueIn(User, 'email', null, { message: 'Email already in use' })
  email: string;
}
```

Validating arrays:

```typescript
import { ExistsIn } from '@rotyro-tools/nestjs-typeorm-validator';

class BulkCreateDto {
  @ExistsIn('tag', 'name', 'replica', {
    each: true,
    message: 'Tag does not exist',
  })
  tagNames: string[];
}
```

---

## Migrating from 1.x to 2.0

1. **No automatic initialization.** If the DataSource you registered is not initialized (typically a `new DataSource(options)` from a config file while NestJS uses its own instance), validations now throw `DataSourceNotInitializedError`. Register the initialized DataSource as shown in [Getting started](#1-register-the-datasource-your-application-already-uses), or pass `{ autoInitialize: true }` when nothing else initializes it.
2. **`each: true` is batched.** Results per value are unchanged, except that `@UniqueIn` now fails when the collection contains exact duplicates.
3. **`@UniqueIn` counts soft-deleted rows.** Pass `includeSoftDeleted: false` to keep the previous behavior.
4. **Only missing TypeORM metadata is a configuration error.** Database errors such as `Table '...' doesn't exist` are now `ValidationQueryError` (previously reported as missing metadata).
5. **Error messages changed.** `ValidationQueryError` and `DataSourceInitializationError` messages now end with the cause message. Update any code that matches on message text.
6. **Typings.** `null` is accepted as the data source name argument, and the error classes and option types are exported.

---

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Format:

```bash
npm run format
```

Run tests:

```bash
npm run test
```

Commit (with Commitizen):

```bash
npm run cm
```
