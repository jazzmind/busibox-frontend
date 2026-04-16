'use client';
/**
 * AppIcon Component
 *
 * Renders app icons using lucide-react. Accepts any lucide icon name
 * (PascalCase) or a legacy name from the original custom icon set.
 * Supports an optional color override for theming.
 */

import { getLucideIcon, resolveLucideIconName } from '../../lib/icons';

type AppIconProps = {
  iconName?: string | null;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  color?: string | null;
  className?: string;
};

const SIZE_MAP = {
  sm: { className: 'w-6 h-6', px: 24 },
  md: { className: 'w-10 h-10', px: 40 },
  lg: { className: 'w-16 h-16', px: 64 },
} as const;

export function AppIcon({ iconName, iconUrl, size = 'md', color, className = '' }: AppIconProps) {
  const { className: sizeClass, px } = SIZE_MAP[size];

  if (iconName) {
    const resolved = resolveLucideIconName(iconName);
    const LucideIcon = getLucideIcon(resolved);
    if (LucideIcon) {
      return (
        <LucideIcon
          size={px}
          className={`flex-shrink-0 ${className}`}
          style={color ? { color } : undefined}
          color={color || 'currentColor'}
          strokeWidth={1.5}
        />
      );
    }
  }

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt="App icon"
        className={`${sizeClass} object-contain flex-shrink-0 ${className}`}
      />
    );
  }

  // Default fallback (grid icon)
  const FallbackIcon = getLucideIcon('LayoutGrid');
  if (FallbackIcon) {
    return (
      <FallbackIcon
        size={px}
        className={`text-gray-400 flex-shrink-0 ${className}`}
        strokeWidth={1.5}
      />
    );
  }

  return (
    <div className={`${sizeClass} text-gray-400 flex-shrink-0 ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    </div>
  );
}
