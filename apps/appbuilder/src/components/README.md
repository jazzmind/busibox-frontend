# Components

This directory contains React components for the application.

## Directory Structure

```
components/
├── auth/           # Authentication components
│   └── AuthContext.tsx
├── ui/             # Shared UI components (add as needed)
├── forms/          # Form components (add as needed)
└── [feature]/      # Feature-specific components
```

## Guidelines

### Component Types

**Server Components** (default):
- Use for static content and data fetching
- No `'use client'` directive needed

**Client Components**:
- Use `'use client'` at the top of the file
- Required for: useState, useEffect, event handlers, browser APIs

### Naming Conventions

- **Files**: PascalCase (`MyComponent.tsx`)
- **Exports**: Named exports preferred
- **Props**: `{ComponentName}Props` interface

### Example Component

```tsx
'use client';

import { useState } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded ${
        variant === 'primary'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-800'
      }`}
    >
      {label}
    </button>
  );
}
```

### Import Patterns

```tsx
// Use path aliases
import { Button } from '@/components/ui';
import { useAuth } from '@/components/auth/AuthContext';
```
