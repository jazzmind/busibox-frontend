/**
 * Theme Toggle Component
 * 
 * Provides a button to toggle between light, dark, and system mode.
 */

'use client';

import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else { // theme === 'system'
      setTheme('light');
    }
  };

  const Icon = resolvedTheme === 'dark' ? Moon : Sun;
  const nextThemeText = theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light';
  const currentThemeText = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
      title={`Switch to ${nextThemeText} Mode (Current: ${currentThemeText})`}
    >
      <Icon className="w-5 h-5" />
      <span className="sr-only sm:not-sr-only">{currentThemeText}</span>
    </button>
  );
}
