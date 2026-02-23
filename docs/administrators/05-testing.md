---
title: "Testing Strategy"
category: "administrator"
order: 5
description: "Testing infrastructure and procedures"
published: true
---

# Testing Strategy

## Test Runner

The test runner is available in the admin UI at `/admin/tests`. It provides a dashboard, runner interface, and history view.

## Test Suites

- **Busibox services**: agent, data, search, authz. Executed via pytest against running services.
- **Security tests**: Authentication, authorization, and security validation.
- **Frontend tests**: Vitest-based unit and component tests.

## Execution

1. Navigate to the test runner
2. Select a test suite
3. Click Run
4. Output streams in real-time via Server-Sent Events (SSE)
5. Results are saved to history when complete

## History

Test results are stored in `.test-history/results.json`. Maximum 1000 results retained. Filter by suite or project.

## Commands

From the project root:

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Quick Actions

The dashboard provides quick actions for common test runs, such as running a specific suite or the full test suite.

## Access and Limits

- Admin-only access. Non-admin users cannot access the test runner.
- 5-minute timeout per test execution. Long-running tests are terminated after this period.
