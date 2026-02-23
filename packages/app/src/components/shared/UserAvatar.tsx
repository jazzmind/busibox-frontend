'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

const AVATAR_GRADIENTS = [
  'from-blue-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-700',
  'from-lime-500 to-emerald-700',
  'from-rose-500 to-red-700',
  'from-indigo-500 to-sky-600',
  'from-amber-500 to-orange-700',
  'from-slate-500 to-gray-700',
];

const SIZE_CLASS: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

function stringHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || 'U';
  }

  const fallback = (email || '').split('@')[0];
  const emailParts = fallback.split(/[._-]/).filter(Boolean);
  if (emailParts.length >= 2) {
    return `${emailParts[0][0]}${emailParts[1][0]}`.toUpperCase();
  }
  return fallback.slice(0, 2).toUpperCase() || 'U';
}

export interface UserAvatarProps {
  name?: string;
  email?: string;
  avatarUrl?: string;
  favoriteColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

function normalizeHexColor(color?: string): string | null {
  if (!color) return null;
  const value = color.trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value)) return null;
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return value.toLowerCase();
}

function shadeHex(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  const r = Math.min(255, Math.max(0, parseInt(raw.slice(0, 2), 16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(raw.slice(2, 4), 16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(raw.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  favoriteColor,
  size = 'md',
  className,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Reset imageFailed when avatarUrl changes (e.g., user sets a new URL)
  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const initials = useMemo(() => buildInitials(name, email), [name, email]);
  const gradientClass = useMemo(() => {
    const seed = name || email || 'user';
    return AVATAR_GRADIENTS[stringHash(seed) % AVATAR_GRADIENTS.length];
  }, [name, email]);
  const normalizedFavoriteColor = useMemo(() => normalizeHexColor(favoriteColor), [favoriteColor]);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name || email || 'User avatar'}
        className={cn(
          'rounded-full object-cover border border-white/20',
          SIZE_CLASS[size],
          className
        )}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br shadow-sm',
        normalizedFavoriteColor ? undefined : gradientClass,
        SIZE_CLASS[size],
        className
      )}
      style={
        normalizedFavoriteColor
          ? { backgroundImage: `linear-gradient(135deg, ${normalizedFavoriteColor} 0%, ${shadeHex(normalizedFavoriteColor, -28)} 100%)` }
          : undefined
      }
      aria-label={name || email || 'User avatar'}
      title={name || email || 'User'}
    >
      {initials}
    </div>
  );
}
