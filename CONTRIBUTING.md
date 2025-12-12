# Contributing to PSCbot

Thank you for your interest in contributing to PSCbot! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in existing issues
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs. actual behavior
   - Environment details (Node.js version, OS, etc.)
   - Error messages or logs (if applicable)

### Suggesting Features

1. Check if the feature has already been suggested
2. Create a new issue with:
   - Clear description of the feature
   - Use case and benefits
   - Potential implementation approach (if you have ideas)

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed
   - Add tests if applicable
4. **Test your changes**:
   ```bash
   npm test
   npm run dev  # Test locally
   ```
5. **Commit your changes**:
   ```bash
   git commit -m "Add: description of your changes"
   ```
   Use clear, descriptive commit messages following conventional commits:
   - `Add:` for new features
   - `Fix:` for bug fixes
   - `Update:` for updates to existing features
   - `Docs:` for documentation changes
   - `Refactor:` for code refactoring
6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**:
   - Provide a clear description
   - Reference any related issues
   - Include screenshots or examples if applicable

## Development Setup

1. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/PSCbot.git
   cd PSCbot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Test the setup**:
   ```bash
   npm test
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

## Code Style Guidelines

### JavaScript

- Use ES6+ features where appropriate
- Follow async/await patterns for asynchronous code
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Keep functions focused and single-purpose

### Error Handling

- Always use try-catch for async operations
- Provide user-friendly error messages
- Log detailed errors for debugging
- Don't expose sensitive information in error messages

### Code Structure

- Keep functions small and focused
- Extract reusable logic into helper functions
- Group related functions together
- Use constants for configuration values

## Testing

- Run `npm test` before submitting PRs
- Test with different input scenarios
- Verify error handling works correctly
- Test edge cases (empty inputs, missing data, etc.)

## Documentation

- Update `QUICKSTART.md` if setup process changes
- Update `PROJECT_SUMMARY.md` if architecture changes
- Add JSDoc comments for new functions
- Update `CHANGELOG.md` for significant changes

## Review Process

1. All PRs require at least one review
2. Address review comments promptly
3. Keep PRs focused - one feature or fix per PR
4. Ensure all tests pass
5. Update documentation as needed

## Questions?

If you have questions about contributing, feel free to:
- Open an issue with the `question` label
- Check existing documentation
- Review existing code for examples

Thank you for contributing to PSCbot! 🚀

