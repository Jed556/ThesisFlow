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
- `build`: Changes that affect the build system or external dependencies

### Recommended scopes for ThesisFlow:
- `ui`: Changes to the web user interface
- `db`: Database schema, queries, or related logic
- `host`: Deployment, server, or hosting configuration
- `ml`: Text-based machine learning, NLP, TF-IDF, or related code

### Examples:
- `fix(ui): Correct button alignment on mobile`
- `feat(ui): Implement user profile page`
- `style(ui): Update button colors for consistency`
- `docs(ui): Add usage instructions to README`
- `fix(db): Correct migration script`
- `feat(db): Add user roles table`
- `chore(db): Remove deprecated columns`
- `chore(host): Update deployment pipeline`
- `feat(host): Add Docker support for local development`
- `ref(ml): Improve tokenization and tfidf logic`
- `feat(ml): Add sentiment analysis module`
- `test(ml): Add tests for text vectorization`
- `test(db): Add integration tests for user queries`
- `build(host): Update CI/CD dependencies`
- `build(ui): Upgrade frontend build tools`

## Rules:
- Use the imperative mood in the subject line (e.g., "fix" not "fixed" or "fixes").
- Limit the subject line to 72 characters or less.
- Reference issues and pull requests when relevant (e.g., `fix: resolve #123`).

## Pull Requests

- Ensure your branch is up to date with `main` before submitting.
- Reference related issues in your pull request description.
- Be responsive to feedback and requested changes.

## Code Style Guidelines

### Quotes
- Double quotes (`"`) for tag attributes and JSON.
- Single quotes (`'`) for JavaScript/TypeScript strings.

### Indentation
- Use 4 spaces per indentation level.
- No tabs.

### Line Length
- Limit lines to 135 characters.

### Semicolons
- Always use semicolons at the end of statements.

### End of Line Sequence
- Use LF (`\n`) for line endings.
- Ensure files end with a single newline character.

### Naming Conventions

#### Files and Folders
- Use `PascalCase` for React components and pages (e.g., `UserProfile.tsx`).
- Use `camelCase` for utility functions and hooks (e.g., `useAuth.ts`).
- Use `snake_case` for scripts and configuration files (e.g., `build_script.sh`).

#### Variables and Functions
- Use `camelCase` for variable and function names (e.g., `getUserData`).
- Use `PascalCase` for class and component names (e.g., `UserProfile`).
- Use `UPPER_SNAKE_CASE` for constants (e.g., `API_URL`).
- You may use `_varName` for private variables within classes or modules.

### Configuration
- ESLint is configured for this project. You may customize the ESLint rules by modifying the `.eslint.config.ts` file along.
- You may also configure other config files like `vercel.json`, `tsconfig.json`, and `vite.config.ts` as needed.

Thank you for helping improve ThesisFlow!
