# Busibox-App Integration Tests

## Overview

These tests verify that the busibox-app service clients work correctly against real services. They are **integration tests** that make actual HTTP calls to:

- Data service (file upload, parsing, embeddings)
- Agent service (LLM chat)
- AuthZ service (audit logging, RBAC)
- External search APIs (Tavily, SerpAPI, Perplexity, Bing)

## Prerequisites

### 1. Services Must Be Running

The following services must be accessible:

- **Data Service**: `DATA_API_HOST:DATA_API_PORT` (default: localhost:8002)
- **Agent Service**: `AGENT_API_URL` (default: http://localhost:8000)
- **AuthZ Service**: `AUTHZ_BASE_URL` (default: http://10.96.200.210:8010)

### 2. Environment Variables

Copy `.env` from the busibox project (already done):

```bash
# From busibox-app directory
cp ../busibox/.env .env
```

Required variables:
```bash
# Data Service
DATA_API_HOST=localhost
DATA_API_PORT=8002

# Agent Service
AGENT_API_URL=http://localhost:8000

# AuthZ Service
AUTHZ_BASE_URL=http://10.96.200.210:8010
AUTHZ_ADMIN_TOKEN=your-admin-token

# Search Providers (optional - tests will skip if not set)
TAVILY_API_KEY=your-tavily-key
SERPAPI_API_KEY=your-serpapi-key
PERPLEXITY_API_KEY=your-perplexity-key
BING_SEARCH_API_KEY=your-bing-key
```

### 3. Install Dependencies

```bash
npm install
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Data client tests
npm test -- data.test.ts

# Embeddings tests
npm test -- embeddings.test.ts

# Agent client tests
npm test -- agent.test.ts

# Audit client tests
npm test -- audit.test.ts

# RBAC client tests
npm test -- rbac.test.ts

# Search providers tests
npm test -- search.test.ts
```

### Run with Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

## Test Suites

### 1. Data Client Tests (`data.test.ts`)

Tests file upload, parsing, URL generation, and deletion.

**What it tests**:
- File upload with authentication
- Markdown parsing
- Presigned URL generation
- File deletion
- Error handling

**Expected outcome**: All files uploaded during tests are cleaned up.

### 2. Embeddings Client Tests (`embeddings.test.ts`)

Tests embedding generation using FastEmbed (bge-large-en-v1.5).

**What it tests**:
- Single embedding generation
- Batch embedding generation
- Embedding similarity calculations
- Error handling

**Expected outcome**: Embeddings are 1024-dimensional vectors.

### 3. Agent Client Tests (`agent.test.ts`)

Tests LLM chat functionality.

**What it tests**:
- Basic chat messages
- Context passing
- Custom API calls
- Timeout handling
- Error handling

**Expected outcome**: Agent responds to queries (may take 30-60 seconds).

### 4. Audit Client Tests (`audit.test.ts`)

Tests audit logging to authz service.

**What it tests**:
- Generic audit events
- User authentication events
- Role management events
- Document events
- Batch logging
- Non-blocking error handling

**Expected outcome**: All audit events are logged successfully.

### 5. RBAC Client Tests (`rbac.test.ts`)

Tests role and permission management via authz service.

**What it tests**:
- Role queries (list, get, search)
- User queries (list, get roles)
- Permission checks (hasRole, isAdmin)
- Role management (create, update, delete)
- User-role assignments
- Error handling

**Expected outcome**: Test role is created and cleaned up.

### 6. Search Providers Tests (`search.test.ts`)

Tests external search API integrations.

**What it tests**:
- Tavily search
- SerpAPI search
- Perplexity search
- Bing search
- Search provider factory
- Error handling

**Expected outcome**: Search results are returned (if API keys are configured).

**Note**: Tests will skip providers without API keys configured.

## Test Coverage Goals

Target: **80% coverage** for all service clients

Coverage includes:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

## Troubleshooting

### Tests Fail with Connection Errors

**Problem**: Cannot connect to services

**Solutions**:
1. Verify services are running:
   ```bash
   # Check data service
   curl http://localhost:8002/health
   
   # Check agent service
   curl http://localhost:8000/health
   
   # Check authz service
   curl http://10.96.200.210:8010/health
   ```

2. Check `.env` file has correct URLs

3. Start services if needed:
   ```bash
   # From busibox/provision/ansible
   make test  # Starts test environment
   ```

### Tests Timeout

**Problem**: Agent tests timeout after 30 seconds

**Solutions**:
1. LLM responses can be slow - this is expected
2. Increase timeout in jest.config.js if needed
3. Check agent service logs for errors

### RBAC Tests Fail

**Problem**: Unauthorized errors in RBAC tests

**Solutions**:
1. Verify `AUTHZ_ADMIN_TOKEN` is set in `.env`
2. Check token is valid in authz service
3. Ensure authz service is running

### Search Tests Skip

**Problem**: All search tests are skipped

**Solutions**:
1. This is normal if API keys aren't configured
2. Add API keys to `.env` to enable search tests
3. Search tests are optional for core functionality

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Busibox-App

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      data:
        image: busibox-data:latest
        ports:
          - 8002:8002
      
      agent:
        image: busibox-agent:latest
        ports:
          - 8000:8000
      
      authz:
        image: busibox-authz:latest
        ports:
          - 8010:8010
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
        env:
          DATA_API_HOST: localhost
          DATA_API_PORT: 8002
          AGENT_API_URL: http://localhost:8000
          AUTHZ_BASE_URL: http://localhost:8010
          AUTHZ_ADMIN_TOKEN: ${{ secrets.AUTHZ_ADMIN_TOKEN }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Notes

1. **Integration vs Unit Tests**: These are integration tests that require real services. They are slower but provide higher confidence.

2. **Test Data**: Tests create and clean up their own data. No manual cleanup needed.

3. **Authentication**: Tests use mock tokens for now. In production, tokens would be obtained from authz service.

4. **Idempotency**: Tests can be run multiple times safely.

5. **Parallel Execution**: Jest runs test files in parallel by default. Individual tests within a file run sequentially.

## Next Steps

After all tests pass:

1. **Publish busibox-app**: `npm run build && npm publish`
2. **Update busibox-portal**: Install published version
3. **Test busibox-portal**: Verify it works with new libraries
4. **Remove legacy code**: Clean up old implementations





