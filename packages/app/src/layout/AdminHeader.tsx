/**
 * Admin Header Component
 * 
 * Header bar for admin pages with portal customization support.
 */

'use client';

import { Button } from '../components/shared/Button';
import { useCustomization } from '../contexts/CustomizationContext';
import { ReactNode } from 'react';

type AdminHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  const { customization } = useCustomization();

  return (
    <header 
      className="border-b shadow-sm"
      style={{ 
        backgroundColor: customization.primaryColor,
        borderColor: customization.secondaryColor 
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold tracking-wide"
              style={{ color: customization.textColor }}
            >
              {title}
            </h1>
            {subtitle && (
              <p 
                className="mt-1 text-sm opacity-80"
                style={{ color: customization.textColor }}
              >
                {subtitle}
              </p>
            )}
          </div>
          
          <div className="flex gap-3 items-center">
            {actions}
            <a href="/admin">
              <Button variant="secondary">
                ← Back to Admin
              </Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

