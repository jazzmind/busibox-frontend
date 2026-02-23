# @jazzmind/busibox-app

Reusable component library for Busibox applications. Provides shared navigation, branding, theming, and layout components that can be used across multiple Next.js apps.

## Installation

### From GitHub Packages

```bash
npm install @jazzmind/busibox-app
```

### Local Development

```bash
# In the busibox-ui directory
npm install
npm run build

# In your consuming app
npm install @jazzmind/busibox-app
```

## Usage

### 1. Wrap your app with providers

```tsx
// app/layout.tsx
import { ThemeProvider, CustomizationProvider } from '@jazzmind/busibox-app';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <CustomizationProvider apiEndpoint="/api/portal-customization">
            {children}
          </CustomizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2. Use the Header component

```tsx
import { Header } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';

const adminNav: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
  { href: '/admin/users', label: 'Manage Users' },
  { href: '/admin/apps', label: 'Manage Apps' },
];

export function MyLayout() {
  const session = useSession(); // Your auth hook
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
  };

  return (
    <Header
      session={session}
      onLogout={handleLogout}
      adminNavigation={adminNav}
      appsLink="/portal/home"
      accountLink="/portal/account"
    />
  );
}
```

### 3. Use the Footer component

```tsx
import { Footer } from '@jazzmind/busibox-app';

export function MyLayout() {
  return (
    <div>
      {/* Your content */}
      <Footer />
    </div>
  );
}
```

## Components

### Layout

- **Header** - Top navigation bar with logo, user menu, theme toggle, and admin navigation
- **Footer** - Footer with customizable company info and contact details
- **ThemeToggle** - Standalone theme toggle button (light/dark/system)

### Contexts

- **ThemeProvider** - Provides theme management (light/dark/system mode)
- **CustomizationProvider** - Provides portal branding and customization

## API

### Header Props

```typescript
type HeaderProps = {
  session: SessionData;           // User session data
  onLogout: () => Promise<void>;  // Logout handler
  adminNavigation?: NavigationItem[]; // Admin menu items
  appsLink?: string;              // Link to apps page (default: '/')
  accountLink?: string;           // Link to account page (default: '/account')
};
```

### CustomizationProvider Props

```typescript
type CustomizationProviderProps = {
  children: React.ReactNode;
  apiEndpoint?: string;                    // API endpoint (default: '/api/portal-customization')
  initialCustomization?: PortalCustomization; // Skip API fetch if provided
};
```

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Watch mode for development
npm run dev

# Type check
npm run type-check
```

## Publishing

This package is published to GitHub Packages:

```bash
npm run build
npm publish
```

## License

MIT

