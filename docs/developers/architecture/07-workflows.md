# Workflow Builder System Architecture

## Type System

Workflow types are defined in `@jazzmind/busibox-app` and exported from `packages/app/src/types/workflow.ts`:

- **Workflow**: id, name, description, active, trigger, steps, guardrails, timestamps
- **WorkflowStep**: id, name, type (agent, tool, condition, human, parallel, loop), type-specific config
- **WorkflowTrigger**: type (manual, cron, webhook, event, agent_completion), config
- **WorkflowGuardrails**: request_limit, total_tokens_limit, tool_calls_limit, timeout_seconds, max_cost_dollars
- **WorkflowExecution**: id, workflow_id, status, trigger_source, input_data, step_outputs, usage, timestamps
- **StepExecution**: id, execution_id, step_id, status, input/output data, usage, timestamps

Condition steps support eight operators: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `exists`.

## Backend Engine Support

The Agent Server workflow engine supports:

- **Tool steps**: search, ingest, RAG
- **Agent steps**: Delegate to an agent with optional prompt
- **Condition steps**: Branching with JSONPath and operators
- **Human-in-loop steps**: Wait for approval, notification channels (email, slack, ui), timeout actions
- **Parallel execution**: Run multiple steps concurrently
- **Loop iteration**: Iterate over items via JSONPath
- **Usage tracking**: Requests, tokens, tool calls, estimated cost

## Database Models

| Model | Purpose |
|-------|---------|
| WorkflowDefinition | Workflow metadata, trigger config, guardrails, steps |
| WorkflowExecution | Execution state, metrics, current step, step_outputs |
| StepExecution | Per-step tracking, input/output, usage, duration |

## REST API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /workflows/{id}/execute | POST | Start workflow execution |
| /workflows/{id}/executions | GET | List executions for a workflow |
| /workflows/executions/{id} | GET | Get execution details |
| /workflows/executions/{id}/steps | GET | Get step executions |
| /workflows/executions/{id}/approve | POST | Submit human approval |

The Agent Server hosts these endpoints. The agents app proxies to the Agent Server via `/api/agent/[...path]` or dedicated workflow routes, with auth token exchange for the agent-api audience.

## Frontend Pages

- **Workflow dashboard**: List workflows with cards, search, and filtering. Located at `app/workflows/` or `app/tasks/` (agents app uses tasks for workflow-like entities).
- **Execution monitoring**: Real-time status, usage metrics, step-by-step view. Auto-refresh every 3 seconds for running executions.

## Usage Limits and Guardrails

- **Cost estimation**: LLM models have estimated cost per token; guardrails can set `max_cost_dollars`.
- **Request limits**: `request_limit` caps LLM requests per execution.
- **Token limits**: `total_tokens_limit` caps total tokens.
- **Tool call limits**: `tool_calls_limit` caps tool invocations.

## Frontend API Routes

Workflow API routes in the agents app proxy to the Agent Server:

- Token exchange for agent-api audience
- Forward request body and headers
- Stream SSE responses for execution status

## File Structure

| Location | Purpose |
|----------|---------|
| app/workflows/ or app/tasks/ | Workflow/task pages |
| app/api/workflows/ or app/api/agent/ | Proxy routes |
| lib/agent-api-client.ts | Workflow methods (list, execute, getExecution, etc.) |
| packages/app/src/types/workflow.ts | Shared type definitions |
