---
title: "Portal Customization"
category: "administrator"
order: 4
description: "Branding and appearance customization for the portal"
published: true
---

# Portal Customization

## Admin UI

Portal customization is managed in the Admin Dashboard. Configure branding, colors, and appearance from a single interface.

## Customizable Elements

- **Organization name**: Display name for the portal
- **Logo**: Organization logo image
- **Colors**: Primary, accent, and background colors
- **Theme**: Light, dark, or system (follows OS preference)

## CustomizationProvider

The `CustomizationProvider` from `@jazzmind/busibox-app` applies settings across all apps in the portal. Changes propagate to portal, agents, documents, and other integrated applications.

## API

- `GET /api/admin/customization` - Retrieve current customization settings
- `PATCH /api/admin/customization` - Update customization settings

## CSS Variables

Theming uses CSS variables. Custom colors are applied as CSS custom properties, allowing consistent styling across components that consume the theme.

## Storage

Settings are stored in the database and applied at runtime. No application restart is required for customization changes to take effect.
