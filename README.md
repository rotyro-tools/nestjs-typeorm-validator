# NestJS TypeORM Validator

Lightweight NestJS decorators for validating values against TypeORM entities.

This package provides several decorators (more to come):

| Decorator   | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| `@ExistsIn` | Ensures a value exists in a specified entity/table column.    |
| `@UniqueIn` | Ensures a value is unique in a specified entity/table column. |

It integrates with TypeORM DataSource instances, enabling database-aware validation in DTOs.

---

## Key features

- Works with TypeORM entity classes or table name strings.
- Supports multiple (named) TypeORM DataSource registrations.
- Supports class-validator options (for example `each` for array validation, or `message` for custom message).
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

## Peer dependencies

This package declares the following peer dependencies that consumers must install at compatible versions:

- [class-validator](https://github.com/typestack/class-validator)
- [typeorm](https://github.com/typeorm/typeorm)

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

1. Register one or more TypeORM DataSources to be used by the validators:

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
  entities: [
    /* ... */
  ],
  synchronize: false,
});

// If you initialize the DataSource yourself, that's fine. If you don't, registerDataSourceForValidation will attempt to initialize it for you.
await dataSource.initialize();

// Register your DataSource
registerDataSourceForValidation(dataSource); // Registers as 'default'

// Second 'replica' DataSource
const replicaDataSource = new DataSource({
  type: 'mysql',
  host: 'replica-host',
  port: 3306,
  username: 'replica_user',
  password: 'replica_pass',
  database: 'db_replica',
  entities: [
    /* ... */
  ],
  synchronize: false,
});

// Optionally initialize the replica DataSource as well
await replicaDataSource.initialize();

// Register your DataSource
registerDataSourceForValidation(replicaDataSource, 'replica');
```

2. Use decorators in your DTOs:

```typescript
import { ExistsIn, UniqueIn } from '@rotyro-tools/nestjs-typeorm-validator';

import { User } from '@/modules/users/entities/user.entity';

class CreatePostDto {
  // Ensure the given authorId exists in the User entity's id column
  // in the 'default' DataSource
  @ExistsIn(User, 'id', null, { message: 'Author not found' })
  authorId: number;

  // Ensure the title is unique in the posts table (using a table name)
  // in the 'replica' DataSource
  @UniqueIn('post', 'title', 'replica', { message: 'Title already taken' })
  title: string;
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

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Lint

```bash
npm run lint
```

Format

```bash
npm run format
```

Run tests:

```bash
npm run test
```
