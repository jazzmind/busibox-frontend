# Demo Features - Deletion Guide

**Delete all demo features before building your production app.**

This document lists all demo features included in the busibox-template and provides instructions for removing them.

## Purpose

The demo features serve to test that your Busibox deployment is working correctly:

- **SSO Authentication**: Verifies user session from AI Portal
- **Data API Operations**: Tests data-api connectivity and CRUD operations
- **Agent API Calls**: Validates Zero Trust token exchange with downstream services

## What Gets Tested

### 1. SSO Authentication
- Session token validation
- User information extraction
- Role-based access control
- Cookie handling and refresh

### 2. Data API Operations
- Data-api connectivity
- Document creation and schema registration
- CRUD operations (Create, Read, Update, Delete)
- Data validation

### 3. Agent API Integration
- Zero Trust token exchange
- Downstream service authentication
- API token propagation
- Error handling and retries

## Deletion Checklist

Follow these steps to remove all demo features:

### Step 1: Delete Demo Files

```bash
# Delete demo page
rm -rf app/demo/

# Delete demo API routes
rm -rf app/api/demo/

# Delete this documentation
rm DEMO.md
```

### Step 2: Update Navigation

Edit `app/app-shell.tsx`:

Remove the demo link (marked with `{/* DEMO LINK - DELETE WHEN BUILDING REAL APP */}`):

```tsx
// DELETE THIS:
<Link href="/demo" className="...">
  Demo Features
</Link>
```

### Step 3: Update Home Page

Edit `app/page.tsx`:

Remove the demo section (marked with `{/* DEMO SECTION - DELETE WHEN BUILDING REAL APP */}`).

### Step 4: Update busibox.json

Edit `busibox.json`:

Update the manifest for your actual app:

```json
{
  "name": "Your App Name",
  "id": "your-app-id",
  "description": "Your app description"
}
```

### Step 5: Update README

Edit `README.md`:

Remove the "Demo Features" section.

### Step 6: Verify Deletion

Check that all demo code is removed:

```bash
# Search for remaining demo references
grep -r "DEMO" app/ --exclude-dir=node_modules
grep -r "demo" app/ --exclude-dir=node_modules

# Should return no results in application code
```

### Step 7: Test Your App

```bash
# Start development server
npm run dev

# Visit http://localhost:3002
# Verify:
# - No /demo route exists (should 404)
# - No demo nav link
# - Home page updated
```

## Files to Delete Summary

### Required Deletions

- `app/demo/page.tsx` - Demo UI page
- `app/api/demo/notes/route.ts` - Notes CRUD API
- `app/api/demo/notes/[id]/route.ts` - Single note operations
- `app/api/demo/agent/route.ts` - Agent API demo
- `DEMO.md` - This file

### Required Modifications

- `busibox.json` - Update app identity
- `app/app-shell.tsx` - Remove demo nav link
- `app/page.tsx` - Remove demo section
- `README.md` - Remove demo documentation

## After Deletion

Your app template will be clean and ready for your production application:

1. No demo code or routes
2. Clean data-api client ready for your data model
3. Updated manifest
4. Production-ready structure

## Building Your Real App

Now that demo features are removed, you can:

1. Define your data model in `lib/data-api-client.ts` (schemas and CRUD functions)
2. Define your types in `lib/types.ts`
3. Create your API routes in `app/api/`
4. Build your UI pages in `app/`
5. Update branding in `app/providers.tsx`
6. Configure environment in `.env.local`
7. Deploy to Busibox infrastructure

See `README.md` and `CLAUDE.md` for development guidance.
