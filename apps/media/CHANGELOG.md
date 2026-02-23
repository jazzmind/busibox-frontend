# Changelog

All notable changes to AI Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-22

### Added
- Personal library types and enhanced library management
- Public landing page and documentation system
- Direct authz-admin client for admin operations
- Session JWT integration for authz options retrieval
- Built-in apps management with active status handling
- Dark mode support across all components
- Typography plugin for improved text styling
- Audit log integration with busibox-app audit functions
- Reranker selection UI and improved search result display
- Health check endpoint

### Changed
- Enhanced authentication flow and session management for passkeys and magic links
- User session management now embeds roles in JWT
- Simplified SSO token handling and authentication cookies for Zero Trust architecture
- Updated authz options to use session JWT
- Refactored built-in apps to always be active and correctly configured
- Improved SessionProvider to prevent rapid re-fetching
- Updated to Prisma 7.3.0
- Migrated to @jazzmind/busibox-app v2.1.15
- Enhanced chat layout with branded header
- Simplified document API routes
- Improved error handling across API routes
- Refactored Prisma client imports to use centralized instance

### Fixed
- Session JWT handling for video processing and status updates
- UserId handling in request payload and headers for video operations
- Magic link and API response handling for improved URL management
- Access token authentication in audit log and dashboard API routes
- Access token retrieval in video API routes
- Passkey registration and authentication flow with JWT exchange
- Web search routing through agent-api for Perplexity support
- Prisma dependencies and configuration
- Search result excerpts to use correct text field from backend
- OAuth2 implementation to match authz service requirements
- User role retrieval with fallback mechanism
- Library tag retrieval to check for library existence
- Chat authentication issues by updating scope requests
- Error handling for API routes during prerendering

### Removed
- Outdated development documentation and Dockerfile.local
- SSO token validation API endpoint
- Unused activate-user script
- Generated Prisma model files
- Personal library types migration

## [0.2.3] - Previous release

See git history for changes prior to v0.3.0.
