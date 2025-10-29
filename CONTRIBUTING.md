# Contributing

Thank you for your interest in contributing to this project. These guidelines are intended to make contributing clear and easy for everyone.

## How to Contribute Code

1. Fork the repository and create a topic branch from `main`:
   ```bash
   git checkout -b fix/description
   ```
2. Make changes and keep commits focused and atomic.
3. Run tests, linting, and formatting locally.
4. Push your branch and open a pull request against `main`.
5. Describe the changes and link related issues (if any).

## Tests

- Add or update tests for new features and bug fixes.
- Ensure test coverage remains as close to 100% as possible.
- For test failures, run tests locally and include the failing output in your PR for context.

## Commit messages

This project follows the Conventional Commits specification. Examples:

- feat(module): add new decorator for X
- fix(validation): correct edge case in UniqueIn validator
- chore(ci): update Node matrix

Commit messages are validated using commitlint and Husky (pre-commit hooks).

## Review & Release

- Maintainers will review and request changes as needed.
- Releases are handled via semantic-release; maintainers will handle publishing.

Thank you for helping to improve this project!
