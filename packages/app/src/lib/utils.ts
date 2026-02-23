import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Darken or lighten a hex color to meet a target contrast ratio against a
 * background. Useful for ensuring text readability on tinted surfaces.
 */
export function getContrastSafeColor(
  hex: string,
  isDark: boolean,
  darkBg: string,
  lightBg: string,
  targetRatio = 4.5
): string {
  const bg = isDark ? darkBg : lightBg;
  const bgRgb = hexToRgb(bg);
  const fgRgb = hexToRgb(hex);
  if (!bgRgb || !fgRgb) return hex;

  const bgLum = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  let { r, g, b } = fgRgb;
  let ratio = getContrastRatio(getLuminance(r, g, b), bgLum);

  const step = isDark ? 10 : -10;
  let iterations = 0;
  while (ratio < targetRatio && iterations < 30) {
    r = Math.min(255, Math.max(0, r + step));
    g = Math.min(255, Math.max(0, g + step));
    b = Math.min(255, Math.max(0, b + step));
    ratio = getContrastRatio(getLuminance(r, g, b), bgLum);
    iterations++;
  }

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}










