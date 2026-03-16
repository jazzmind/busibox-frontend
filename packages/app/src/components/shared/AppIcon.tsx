'use client';
/**
 * AppIcon Component
 * 
 * Displays an app icon from the icon library or fallback.
 */


import { getIcon, type IconName } from '../../lib/icons';

type AppIconProps = {
  iconName?: IconName | string | null;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function AppIcon({ iconName, iconUrl, size = 'md', className = '' }: AppIconProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  // Try to get icon from library first
  if (iconName) {
    const icon = getIcon(iconName as IconName);
    if (icon) {
      return (
        <div 
          className={`${sizeClasses[size]} text-gray-700 flex-shrink-0 ${className}`}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      );
    }
  }

  // Fallback to iconUrl if provided
  if (iconUrl) {
    return (
      <img 
        src={iconUrl} 
        alt="App icon"
        className={`${sizeClasses[size]} object-contain flex-shrink-0 ${className}`}
      />
    );
  }

  // Default fallback icon (grid/app icon)
  return (
    <div className={`${sizeClasses[size]} text-gray-400 flex-shrink-0 ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    </div>
  );
}

