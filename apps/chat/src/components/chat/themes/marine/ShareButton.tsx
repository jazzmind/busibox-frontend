'use client';

/**
 * Share control — a link icon in the chat header.
 *
 * Opens a small popover where the conversation owner can turn on "Anyone
 * signed in can view" (sets `link_access: 'org'` via PATCH /conversations/:id)
 * and copy the conversation URL. Viewers who arrive through such a link see a
 * read-only banner instead of this control (see ChatShell).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Link2, Lock, Users } from 'lucide-react';
import type { Conversation } from '@jazzmind/busibox-app/types/chat';
import { Tooltip } from './primitives/Tooltip';

interface ShareButtonProps {
  conversation: Conversation | null;
  apiCall: (endpoint: string, options?: RequestInit) => Promise<Response>;
  /** Called with the updated conversation after a successful change. */
  onUpdated?: (conv: Conversation) => void;
  /** Query-string key the chat page reads the conversation id from. */
  queryParam?: string;
}

function shareUrlFor(conversationId: string, queryParam: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(queryParam, conversationId);
  return url.toString();
}

export function MarineShareButton({
  conversation,
  apiCall,
  onUpdated,
  queryParam = 'conversation',
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const linkAccess = conversation?.linkAccess ?? 'private';
  const isOrg = linkAccess === 'org';

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const setAccess = useCallback(
    async (next: 'private' | 'org') => {
      if (!conversation || saving || next === linkAccess) return;
      setSaving(true);
      try {
        const res = await apiCall(`/conversations/${conversation.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ link_access: next }),
        });
        const data = await res.json().catch(() => ({}));
        onUpdated?.({ ...conversation, linkAccess: data.link_access ?? next });
      } catch (e) {
        console.error('Failed to update link access', e);
        toast.error('Could not update sharing');
      } finally {
        setSaving(false);
      }
    },
    [apiCall, conversation, linkAccess, onUpdated, saving],
  );

  const copy = useCallback(async () => {
    if (!conversation) return;
    try {
      await navigator.clipboard.writeText(shareUrlFor(conversation.id, queryParam));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the link');
    }
  }, [conversation, queryParam]);

  const shareUrl = conversation ? shareUrlFor(conversation.id, queryParam) : '';

  if (!conversation) return null;

  const label = isOrg ? 'Shared: anyone signed in can view' : 'Share this chat';

  return (
    <div ref={wrapRef} className="relative">
      <Tooltip label={label} side="bottom">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={label}
          aria-expanded={open}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--marine-teal-tint)]"
          style={{
            color: isOrg ? 'var(--marine-teal)' : 'var(--marine-text-subtle)',
            backgroundColor: isOrg ? 'var(--marine-teal-light)' : 'transparent',
            border: `1px solid ${isOrg ? 'var(--marine-teal-border)' : 'transparent'}`,
          }}
        >
          <Link2 className="h-4 w-4" />
        </button>
      </Tooltip>

      {open && (
        <div
          role="dialog"
          aria-label="Share conversation"
          className="absolute right-0 top-10 z-50 w-[320px] rounded-lg border p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--marine-surface)',
            borderColor: 'var(--marine-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <p className="pb-2 text-sm font-semibold" style={{ color: 'var(--marine-text)' }}>
            Share this chat
          </p>

          <div className="flex flex-col gap-1">
            <AccessOption
              active={!isOrg}
              disabled={saving}
              icon={<Lock className="h-4 w-4" />}
              title="Only me"
              description="Private to you (and anyone you've shared it with directly)."
              onClick={() => void setAccess('private')}
            />
            <AccessOption
              active={isOrg}
              disabled={saving}
              icon={<Users className="h-4 w-4" />}
              title="Anyone signed in can view"
              description="Coworkers with the link can read this chat. They can't send messages."
              onClick={() => void setAccess('org')}
            />
          </div>

          <div
            className="mt-3 flex items-center gap-2 rounded-md border px-2 py-1.5"
            style={{
              borderColor: 'var(--marine-border)',
              backgroundColor: 'var(--marine-surface-alt)',
            }}
          >
            <span
              className="min-w-0 flex-1 truncate text-xs"
              style={{ color: 'var(--marine-text-muted)' }}
              title={shareUrl}
            >
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-white transition-all hover:brightness-105 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--marine-teal)' }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          {!isOrg && (
            <p className="pt-2 text-[11px]" style={{ color: 'var(--marine-text-subtle)' }}>
              The link only works for you until you choose “Anyone signed in can view”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AccessOption({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors disabled:opacity-60"
      style={{
        borderColor: active ? 'var(--marine-teal-border)' : 'transparent',
        backgroundColor: active ? 'var(--marine-teal-light)' : 'transparent',
      }}
    >
      <span className="mt-0.5" style={{ color: active ? 'var(--marine-teal-dark)' : 'var(--marine-text-subtle)' }}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium" style={{ color: active ? 'var(--marine-teal-dark)' : 'var(--marine-text)' }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--marine-text-muted)' }}>
          {description}
        </span>
      </span>
      {active && <Check className="ml-auto mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--marine-teal)' }} />}
    </button>
  );
}
