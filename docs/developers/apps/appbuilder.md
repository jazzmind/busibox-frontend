# App Builder

**Package:** @busibox/appbuilder  
**Port:** 3004  
**Base path:** /builder

## Purpose

AI-native application builder for creating apps on the Busibox platform. Enables visual app creation and configuration.

## Routes

- /build
- /demo
- /library
- /api/*

## Structure

Has its own app-shell.tsx and providers.tsx. Different structure from portal-family apps (portal, admin, chat, documents, media).

## Dependencies

Uses busibox-app for shared components.

## Tech Stack

- Next.js 16
- Tailwind CSS 4
