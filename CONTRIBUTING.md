# Contributing to CoreDNS Admin

We love your input! We want to make contributing to CoreDNS Admin as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code follows the style guidelines.
6. Issue that pull request!

## Pull Request Process

1. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
2. Increase the version numbers in any examples files and the README.md to the new version that this Pull Request would represent.
3. You may merge the Pull Request once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## Code Style

### Python (Backend)

- Follow PEP 8 style guidelines
- Use type hints where possible
- Write docstrings for all functions and classes
- Run `black` for code formatting
- Run `flake8` for linting

```bash
# Install development dependencies
pip install black flake8 mypy

# Format code
black backend/

# Lint code
flake8 backend/

# Type checking
mypy backend/
```

### TypeScript/React (Frontend)

- Follow the existing code style and patterns
- Use TypeScript strict mode
- Write meaningful component and variable names
- Use the established UI component library

```bash
# Install dependencies
cd frontend && npm install

# Run linting
npm run lint

# Run formatting
npm run format

# Type checking
npm run type-check
```

## Any contributions you make will be under the MIT Software License

When you submit code changes, your submissions are understood to be under the same [MIT License](LICENSE) that covers the project.

## Report bugs using GitHub's [issue tracker](https://github.com/coredns-admin/coredns-admin/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/coredns-admin/coredns-admin/issues/new).

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## License

By contributing, you agree that your contributions will be licensed under its MIT License.