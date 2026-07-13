'use client';

import { Grid2x2, Sun, ChevronDown } from 'lucide-react';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Tooltip } from './Tooltip';

interface CashmanHeaderProps {
  appsHref?: string;
  /** Fallback name shown if the session isn't populated (mainly for the /demo route). */
  fallbackName?: string;
  fallbackRole?: string;
}

export function CashmanHeader({
  appsHref = '/portal/home',
  fallbackName = 'User',
  fallbackRole = 'Member',
}: CashmanHeaderProps) {
  const session = useSession();
  const email: string = (session as any)?.user?.email || (session as any)?.email || '';
  const displayName: string =
    (session as any)?.user?.name ||
    (session as any)?.user?.displayName ||
    (email ? email.split('@')[0] : fallbackName);
  const role: string = (session as any)?.user?.role || fallbackRole;
  const initial = displayName?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header
      className="flex h-16 w-full flex-shrink-0 items-center justify-between px-4 text-white shadow-md sm:px-8"
      style={{ backgroundColor: '#0f3e18' }}
    >
      <div className="flex flex-col leading-tight tracking-wider">
        <span className="text-[16px] font-bold text-white sm:text-[20px]">
          Cashman AI Portal
        </span>
        <span className="hidden text-[10px] text-white/80 sm:block">
          Think AImpossible!
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Tooltip label="Browse apps" side="bottom">
          <a
            href={appsHref}
            className="flex items-center gap-2 rounded-[10px] p-2 text-white transition-colors hover:bg-white/10"
          >
            <Grid2x2 className="h-5 w-5" />
            <span className="hidden text-base sm:inline">Apps</span>
          </a>
        </Tooltip>

        <Tooltip label="System settings" side="bottom">
          <button
            type="button"
            className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-white transition-colors hover:bg-white/10"
          >
            <Sun className="h-5 w-5" />
            <span className="hidden text-base sm:inline">System</span>
          </button>
        </Tooltip>

        <Tooltip label={`${displayName} · ${role}`} side="bottom">
          <div className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-white/10 sm:px-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #00bc7d 0%, #009689 100%)',
              }}
            >
              {initial}
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm text-white">{displayName}</span>
              <span className="text-xs text-white/70">{role}</span>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-white/80 sm:block" />
          </div>
        </Tooltip>
      </div>
    </header>
  );
}
