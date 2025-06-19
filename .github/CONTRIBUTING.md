# Contributing to ThesisFlow

Thank you for your interest in contributing! We welcome all kinds of contributions, including bug reports, new tasks/features, and documentation improvements.

## How to Contribute

1. **Fork the repository** and create your branch from `main`.
2. **Make your changes** with clear, descriptive commit messages following the Conventional Commits format (see below).
3. **Test your changes** to ensure they work as expected.
4. **Submit a pull request** with a clear description of your changes.

## Reporting Bugs

- Use the **Bug Report** issue template.
- Provide as much detail as possible, including steps to reproduce, expected behavior, and environment information.

## Proposing New Tasks or Features

- Use the **New Task** issue template.
- Clearly describe the task or feature, motivation, and any proposed solutions.

## Coding Standards

- Follow consistent code style and formatting.
- Write clear, concise comments where necessary.
- Add or update documentation as needed.

## Commit Message Guidelines (Conventional Commits)

We use the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This helps automate releases, changelogs, and improves collaboration.

### Format:
```
type(scope?): subject
```
- `type`: The type of change (see [types](#common-types) below)
- `scope`: (optional) The area of the codebase affected (see [scopes](#recommended-scopes-for-thesisflow) below)
- `subject`: A short description of the change

### Common types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (formatting, etc)
- `ref`: Code changes that neither fix a bug nor add a feature
- `test`: Adding or correcting tests
- `chore`: Maintenance tasks

### Recommended scopes for ThesisFlow:
- `ui`: Changes to the web user interface
- `db`: Database schema, queries, or related logic
- `host`: Deployment, server, or hosting configuration
- `ml`: Text-based machine learning, NLP, TF-IDF, or related code

### Examples:
- `fix(ui): correct button alignment on mobile`
- `feat(ui): implement user profile page`
- `style(ui): update button colors for consistency`
- `docs(ui): add usage instructions to README`
- `fix(db): correct migration script`
- `feat(db): add user roles table`
- `chore(db): remove deprecated columns`
- `chore(host): update deployment pipeline`
- `feat(host): add Docker support for local development`
- `ref(ml): improve tokenization and tfidf logic`
- `feat(ml): add sentiment analysis module`
- `test(ml): add tests for text vectorization`
- `test(db): add integration tests for user queries`

## Rules:
- Use the imperative mood in the subject line (e.g., "fix" not "fixed" or "fixes").
- Limit the subject line to 72 characters or less.
- Reference issues and pull requests when relevant (e.g., `fix: resolve #123`).

## Pull Requests

- Ensure your branch is up to date with `main` before submitting.
- Reference related issues in your pull request description.
- Be responsive to feedback and requested changes.

Thank you for helping improve ThesisFlow!
