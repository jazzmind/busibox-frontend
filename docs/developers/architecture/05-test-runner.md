# Test Runner Architecture

## System Overview

The test runner allows administrators to run and monitor tests for Busibox services from the admin UI. The flow is:

```
Browser client -> Next.js API routes -> deploy-api -> child process -> pytest/vitest
```

The admin app does not spawn child processes directly. It proxies requests to the deploy-api, which has access to the busibox repository and Docker socket. The deploy-api spawns `make test-docker` (or equivalent) and streams output back via Server-Sent Events.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| /api/admin/tests | GET | List test suites (proxy to deploy-api /api/v1/tests/suites) |
| /api/admin/tests/list | GET | List test files for a service (proxy to deploy-api /api/v1/tests/list) |
| /api/admin/tests/run | POST | Run tests blocking (legacy) |
| /api/admin/tests/stream | POST | Run tests with SSE stream (primary) |
| /api/admin/tests/history | GET/POST/DELETE | Test result history |

All routes require admin role. The deploy-api enforces an environment guard: test runner is disabled in production (returns 403 with a message).

## Test Execution Flow

1. User clicks run on a TestSuiteCard.
2. TestRunner modal opens with the selected suite.
3. Client sends POST to `/api/admin/tests/stream` with `{ suiteId, service, makeArgs, isSecurity }`.
4. Admin API route exchanges for deploy-api token and forwards the request.
5. Deploy-api spawns a child process (e.g., `make test-docker SERVICE=agent`).
6. Deploy-api streams SSE events: `start`, `stdout`, `stderr`, `complete`.
7. Client parses SSE, renders ANSI output, and shows result (success/fail, exit code).
8. Results can be saved to history (`.test-history/results.json`, max 1000 entries).

## Component Hierarchy

```
/admin/tests                    # Dashboard
├── QuickActions                # Quick run, history link
└── Test Suites cards           # Links to runner, history, permissions

/admin/tests/runner              # Test Runner page
├── TestFilters                 # search, project, type, framework
├── TestSuiteCard (grid)        # Per-suite card with expand, run, file selection
└── TestRunner (modal)           # SSE consumer, ANSI renderer, close

/admin/tests/history             # Results table
└── Results table with statistics
```

## Test Suites

Suites are defined by the deploy-api and include:

- **Busibox services**: agent, data, search, authz
- **Security tests**: Separate category with `isSecurity` flag
- **Frontend tests**: Vitest-based suites

Each suite has: `id`, `name`, `project`, `service`, `type`, `framework` (pytest or vitest), `makeArgs`, `description`, `estimatedDuration`, optional `path`, optional `isSecurity`.

## State Management

- **testSuites**: Full list from GET /api/admin/tests
- **filteredSuites**: Filtered by search, project, type, framework
- **runningTests**: Set of suite IDs currently running
- **testResults**: Map of suite ID to `{ success, duration, timestamp }`
- **filters**: `{ search, project, type, framework }`

## History Storage

- **Location**: `.test-history/results.json` (or equivalent in deploy-api)
- **Max entries**: 1000 results
- **Fields**: suite ID, timestamp, success, duration, exit code, output snippet

## Security

- **Admin role enforcement**: All test routes check `user.roles?.includes('Admin')`.
- **Path validation**: Test paths are validated to prevent directory traversal.
- **Command sanitization**: makeArgs and service names are validated before spawning.
- **Timeout**: Test runs have a 5-minute timeout (`maxDuration = 300` on the stream route).

## Performance

Target latencies:

- Suite list: under 100ms
- Filter apply: under 10ms
- Test start (first SSE): under 500ms
- History load: under 200ms
