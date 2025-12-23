# WAG_Dashboard
GUI Dashboard for Data Manipulation and Staging

## Continuous Integration

This project includes automated testing via GitHub Actions that runs on every pull request and push to main/develop branches.

### CI Pipeline Features

- **Automated Testing**: Runs all tests using `npm run test:coverage`
- **Multi-Node Support**: Tests against Node.js 18.x and 20.x
- **Code Coverage**: Generates and uploads coverage reports
- **Linting**: Runs ESLint to ensure code quality
- **Test Artifacts**: Uploads test results and coverage reports

### Local Testing

Run tests locally before pushing:

```bash
# Run tests once
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run linting
npm run lint
```

### CI Status

The CI pipeline will automatically:
- Run on pull requests to main/develop branches
- Block merging if tests fail
- Generate coverage reports and upload as artifacts
- Comment on PRs with coverage information
# Force rebuild
