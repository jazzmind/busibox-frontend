'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  Plus,
  MessageSquare,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Conversation } from '@jazzmind/busibox-app/types/chat';
import { Tooltip } from './Tooltip';

interface CashmanSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conv: Conversation) => void;
  onCreateConversation: () => void;
  /** Optional; when provided, expanded rows show a red trash icon on hover. */
  onDeleteConversation?: (conv: Conversation) => void;
}

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const DURATION = 260;

const WIDTH_STORAGE_KEY = 'cashman-sidebar-width';
const COLLAPSED_WIDTH = 56;
const DEFAULT_EXPANDED_WIDTH = 280;
const MIN_EXPANDED_WIDTH = 220;
const MAX_EXPANDED_WIDTH = 420;

/** Auto-collapse when the viewport is this narrow or less. */
const AUTO_COLLAPSE_BREAKPOINT = 768;

function clampWidth(candidate: number): number {
  return Math.min(
    Math.max(candidate, MIN_EXPANDED_WIDTH),
    MAX_EXPANDED_WIDTH,
  );
}

function readPersisted(): number {
  if (typeof window === 'undefined') return DEFAULT_EXPANDED_WIDTH;
  const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? clampWidth(parsed) : DEFAULT_EXPANDED_WIDTH;
}

export function CashmanSidebar({
  collapsed,
  onToggleCollapsed,
  conversations,
  currentConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
}: CashmanSidebarProps) {
  const [preferredWidth, setPreferredWidth] = useState(DEFAULT_EXPANDED_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Auto-collapse tracking: remember if we forced collapse due to narrow viewport
  // so we can expand back when the viewport widens (but only if the user hasn't
  // manually toggled since).
  const autoCollapsedRef = useRef(false);

  useEffect(() => {
    setPreferredWidth(readPersisted());

    const onResize = () => {
      const narrow = window.innerWidth <= AUTO_COLLAPSE_BREAKPOINT;
      if (narrow && !collapsed) {
        autoCollapsedRef.current = true;
        onToggleCollapsed();
      } else if (!narrow && collapsed && autoCollapsedRef.current) {
        autoCollapsedRef.current = false;
        onToggleCollapsed();
      }
    };
    // Fire once on mount to respect current viewport
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // Intentionally not depending on collapsed/onToggleCollapsed — that would
    // re-run the auto-collapse logic on every manual toggle and fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user manually toggles, clear the auto-collapsed memory so the next
  // viewport crossing doesn't fight them.
  useEffect(() => {
    autoCollapsedRef.current = false;
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (dragging) return;
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(preferredWidth));
  }, [preferredWidth, dragging]);

  const width = collapsed ? COLLAPSED_WIDTH : preferredWidth;

  // Splitter (right edge) drag handlers
  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return;
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      dragStartX.current = e.clientX;
      dragStartWidth.current = preferredWidth;
      setDragging(true);
    },
    [collapsed, preferredWidth],
  );

  const onSplitterPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      // Splitter is on the right edge; dragging RIGHT increases width
      const delta = e.clientX - dragStartX.current;
      setPreferredWidth(clampWidth(dragStartWidth.current + delta));
    },
    [dragging],
  );

  const onSplitterPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  return (
    <aside
      className="relative flex h-full flex-shrink-0 flex-col border-r bg-[var(--cashman-surface)]"
      style={{
        width,
        borderColor: 'var(--cashman-border)',
        transition: dragging ? 'none' : `width ${DURATION}ms ${EASE}`,
        // overflow left visible so tooltips can escape to the right; internal
        // scroll is handled by the nested list container below
        overflow: 'visible',
      }}
    >
      <div
        className="flex h-12 items-center justify-between border-b"
        style={{
          borderColor: 'var(--cashman-border)',
          padding: collapsed ? '0 12px' : '0 16px',
          transition: `padding ${DURATION}ms ${EASE}`,
        }}
      >
        <div
          className="flex items-center gap-2 overflow-hidden"
          style={{
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? 0 : 200,
            transition: `opacity ${DURATION}ms ${EASE}, max-width ${DURATION}ms ${EASE}`,
            whiteSpace: 'nowrap',
          }}
        >
          <Sparkles className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--cashman-teal)' }} />
          <span
            className="text-[16px] font-bold tracking-wider"
            style={{ color: 'var(--cashman-text)' }}
          >
            CASHMAN AI
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] text-white shadow-sm outline-none transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--cashman-teal)]/40"
          style={{ backgroundColor: 'var(--cashman-teal)' }}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <div
        style={{
          padding: '10px',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'stretch',
        }}
      >
        <Tooltip label="Start a new chat" side="right">
          <button
            type="button"
            onClick={onCreateConversation}
            className="group flex items-center rounded-full text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
            style={{
              width: collapsed ? 36 : '100%',
              height: 36,
              padding: collapsed ? 0 : '0 14px',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              backgroundColor: 'var(--cashman-teal)',
              transition: `all ${DURATION}ms ${EASE}, transform 150ms`,
              boxShadow: '0 1px 3px rgba(6,130,132,0.35)',
            }}
          >
            <Plus className="h-[18px] w-[18px] flex-shrink-0 transition-transform group-hover:rotate-90" />
            {!collapsed && (
              <span className="overflow-hidden whitespace-nowrap">
                New chat
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      <div
        className="flex items-center gap-2 pb-1"
        style={{
          padding: collapsed ? '0 0 4px 0' : '0 18px 4px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: `padding ${DURATION}ms ${EASE}`,
        }}
      >
        <MessageSquare className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--cashman-text-body)' }} />
        <span
          className="text-base font-medium"
          style={{
            color: 'var(--cashman-text-body)',
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? 0 : 200,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: `opacity ${DURATION}ms ${EASE}, max-width ${DURATION}ms ${EASE}`,
          }}
        >
          Recent
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: collapsed ? '4px 8px 0' : '4px 10px 0',
          transition: `padding ${DURATION}ms ${EASE}`,
        }}
      >
        {conversations.length === 0 && !collapsed ? (
          <p className="px-2 py-3 text-sm" style={{ color: 'var(--cashman-text-muted)' }}>
            No conversations yet
          </p>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId;

              // Shared select-conversation button. Sibling (not child) of the
              // trash icon so click-events don't tangle.
              const selectBtn = (
                <button
                  type="button"
                  onClick={() => onSelectConversation(conv)}
                  className="flex w-full items-center overflow-hidden text-left transition-all active:scale-[0.98]"
                  style={{
                    height: collapsed ? 36 : 37,
                    width: collapsed ? 36 : '100%',
                    padding: collapsed ? 0 : '0 9px',
                    // Reserve room on the right for the trash icon when
                    // expanded so the title doesn't sit under it on hover.
                    paddingRight: !collapsed && onDeleteConversation ? 32 : undefined,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 8,
                    color: isActive ? 'var(--cashman-teal-dark)' : 'var(--cashman-text-muted)',
                    backgroundColor: isActive ? 'var(--cashman-teal-light)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--cashman-teal-border)' : 'transparent'}`,
                    transition: `all ${DURATION}ms ${EASE}, background-color 150ms, color 150ms`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--cashman-teal-tint)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {collapsed ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : (
                    <span
                      className="truncate text-base"
                      style={{ fontWeight: isActive ? 500 : 400 }}
                    >
                      {conv.title || 'New Conversation'}
                    </span>
                  )}
                </button>
              );

              // Expanded row: wrap in a group container so the trash icon can
              // fade in on hover. Collapsed row: no delete affordance (icon
              // has nowhere to go without crowding), use the tooltip preview
              // exactly as before.
              if (collapsed) {
                return (
                  <Tooltip
                    key={conv.id}
                    side="right"
                    preview={
                      <div className="p-3">
                        <div className="flex items-center gap-2 pb-1">
                          <MessageSquare
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: 'var(--cashman-teal)' }}
                          />
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: 'var(--cashman-text-subtle)', letterSpacing: '0.08em' }}
                          >
                            Conversation
                          </span>
                        </div>
                        <p
                          className="text-sm font-semibold leading-[20px]"
                          style={{ color: 'var(--cashman-text)' }}
                        >
                          {conv.title || 'New Conversation'}
                        </p>
                        <p
                          className="pt-1 text-xs"
                          style={{ color: 'var(--cashman-text-muted)' }}
                        >
                          {conv.messageCount
                            ? `${conv.messageCount} message${conv.messageCount === 1 ? '' : 's'}`
                            : 'No messages yet'}
                        </p>
                      </div>
                    }
                  >
                    {selectBtn}
                  </Tooltip>
                );
              }

              return (
                <div key={conv.id} className="group relative">
                  {selectBtn}
                  {onDeleteConversation && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Delete "${conv.title || 'New Conversation'}"? This cannot be undone.`,
                          )
                        ) {
                          onDeleteConversation(conv);
                        }
                      }}
                      aria-label="Delete conversation"
                      title="Delete conversation"
                      className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity focus:opacity-100 focus:outline-none group-hover:opacity-100"
                      style={{ color: '#ef4444' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          'rgba(239, 68, 68, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={onSplitterPointerDown}
          onPointerMove={onSplitterPointerMove}
          onPointerUp={onSplitterPointerUp}
          onPointerCancel={onSplitterPointerUp}
          className="group absolute right-0 top-0 z-10 flex h-full w-2 translate-x-1 cursor-col-resize items-center justify-center"
          style={{ touchAction: 'none' }}
          title="Drag to resize"
        >
          <span
            className="pointer-events-none block h-full w-[2px]"
            style={{
              backgroundColor: dragging ? 'var(--cashman-teal)' : 'transparent',
              transition: 'background-color 150ms',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute h-8 w-[3px] rounded-full opacity-0 transition-opacity group-hover:opacity-70"
            style={{
              backgroundColor: dragging ? 'var(--cashman-teal)' : 'var(--cashman-teal-muted)',
              opacity: dragging ? 1 : undefined,
            }}
          />
        </div>
      )}
    </aside>
  );
}
