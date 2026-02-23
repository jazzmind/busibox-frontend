# Changelog

All notable changes to Agent Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added
- Task management system with notification channels and output saving
- Visual drag-drop workflow editor with ReactFlow
- Workflow dashboard and execution monitoring UI
- Auto-layout and position persistence to workflow editor
- Agent Tasks UI pages and API routes
- Comprehensive chat interface components with SSE streaming
- Database persistence for conversations
- Agent list view and detail pages
- Models API route
- Dark mode support across all components
- Health check endpoint
- Integration with Python agent-server
- Custom Header component with UserDropdown integration
- Enhanced date utility functions and formatting
- Output content extraction and formatting in execution pages

### Changed
- Refactored CustomHeader to utilize UserDropdown from busibox-app
- Enhanced SSO authentication to align with Zero Trust architecture
- Updated to @jazzmind/busibox-app v2.1.15
- Improved agent API handling and date utilities
- Enhanced task detail page with agent loading and display
- Streamlined authentication and session management
- Upgraded to Next.js 16 with Cache Components enabled
- Simplified health check endpoint and response structure
- Updated API routes to use Python agent-server
- Refactored navigation to use Next.js Link component
- Enhanced layout with Header, Footer, and VersionBar components

### Fixed
- Regex pattern for content extraction in execution pages
- Authentication issuer and local URLs
- Workflow agent field validation and duplicate function
- Next.js 15 async params handling in dynamic routes
- Workflow list page to handle missing trigger field
- Admin workflows route authentication
- Workflow API routes to use correct token field
- Models endpoint to parse OpenAI-compatible response format
- Auth middleware for agent creation and detail endpoints
- Tailwind dark mode configuration
- Error message handling in agent-api-client
- Agent-server IP address to 10.96.200.202
- Subdirectory routing for /agents path
- BasePath-aware fetch for admin and simulator
- Access token calls with correct service parameter

### Removed
- Redundant chat and simulator pages
- Local Dockerfile (now uses centralized deployment)
- All Mastra framework dependencies and references
- Prisma dependencies (uses agent-server API)
- Database client (moved to agent-server)
- Outdated documentation files

### Migration Notes
- This release represents a major refactor from Mastra framework to Python agent-server
- All database access now goes through agent-server API
- Authentication now uses Zero Trust architecture with authz service
- Workflows now use visual editor instead of code-based definitions

## [0.0.3] - Previous release

See git history for changes prior to v0.1.0.
