/**
 * Cashman UI demo route — no auth, no backend, mock data only.
 * Includes static canned replies so the send interaction and streaming animation
 * can be exercised without the agent API.
 */

'use client';

import { Toaster } from 'react-hot-toast';
import { useState, useRef, useCallback } from 'react';
import { CashmanHeader } from '../../components/chat/CashmanHeader';
import { CashmanSidebar } from '../../components/chat/CashmanSidebar';
import { CashmanEmptyState } from '../../components/chat/CashmanEmptyState';
import { CashmanMessages } from '../../components/chat/CashmanMessages';
import { CashmanComposer } from '../../components/chat/CashmanComposer';
import { CashmanSourcePanel } from '../../components/chat/CashmanSourcePanel';
import type {
  Conversation,
  Message,
  MessageCitation,
} from '@jazzmind/busibox-app/types/chat';
import type { CitationPreviewData } from '../../components/chat/CitationPreview';

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'demo-1',
    userId: 'demo-user',
    title: 'New Conversation',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 0,
  },
  {
    id: 'demo-2',
    userId: 'demo-user',
    title: 'What holidays do we get in 2026?',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 2,
  },
  {
    id: 'demo-3',
    userId: 'demo-user',
    title: 'Health insurance options',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 4,
  },
  {
    id: 'demo-4',
    userId: 'demo-user',
    title: 'Employee referral program',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 3,
  },
  {
    id: 'demo-5',
    userId: 'demo-user',
    title: 'PTO accrual rates',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 6,
  },
  {
    id: 'demo-6',
    userId: 'demo-user',
    title: 'About Sledgewood',
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 1,
  },
];

const HOLIDAY_MSGS: Message[] = [
  {
    id: 'u1',
    conversationId: 'demo-2',
    role: 'user',
    content: 'What are our 2026 company holidays?',
    createdAt: new Date(),
  },
  {
    id: 'a1',
    conversationId: 'demo-2',
    role: 'assistant',
    content: `Here is the 2026 holiday schedule for Sledgewood:

Sledgewood observes eleven paid company holidays in 2026. The office is closed on these dates:

- New Year's Day: January 1, 2026 (Thursday)
- Martin Luther King Jr. Day: January 19, 2026 (Monday)
- Presidents Day: February 16, 2026 (Monday)
- Memorial Day: May 25, 2026 (Monday)
- Juneteenth: June 19, 2026 (Friday)
- Independence Day (observed): July 3, 2026 (Friday)
- Labor Day: September 7, 2026 (Monday)
- Thanksgiving Day: November 26, 2026 (Thursday)
- Day after Thanksgiving: November 27, 2026 (Friday)
- Christmas Eve: December 24, 2026 (Thursday)
- Christmas Day: December 25, 2026 [Friday](doc:holiday-2026:1)

Each employee also receives **two floating holidays** per year to use for observances not on the fixed list. Floating holidays do not carry over and are separate from PT[O](doc:holiday-2026:2).

A company holiday does not count against your PTO balance. If a holiday falls on a weekend, the office observes it on the nearest weekd[ay](doc:holiday-2026:3).`,
    citations: [
      { fileId: 'holiday-2026', filename: 'Holiday Schedule 2026', page: 1 },
      { fileId: 'holiday-2026', filename: 'Holiday Schedule 2026', page: 2 },
      { fileId: 'holiday-2026', filename: 'Holiday Schedule 2026', page: 3 },
    ],
    createdAt: new Date(),
  },
];

/** Canned answers keyed off simple substring match in the user question. */
const CANNED_ANSWERS: Array<{
  match: RegExp;
  answer: string;
  citations: MessageCitation[];
}> = [
  {
    match: /pto|accrual|vacation/i,
    answer: `**PTO (Paid Time Off)** at Sledgewood covers vacation and personal days from a single pool.

- Full-time employees accrue **1.67 days per month** in their first two years.
- After **two years** of service, the rate increases to **2.08 days per month**.
- Unused PTO carries over up to **80 hours** into the next calendar [year](doc:pto-policy:1).

Accrual starts on your **first day** and posts on the last calendar day of each month. Manager approval is required for stretches longer than one work [week](doc:pto-policy:2).`,
    citations: [
      { fileId: 'pto-policy', filename: 'PTO Policy 2026', page: 1 },
      { fileId: 'pto-policy', filename: 'PTO Policy 2026', page: 2 },
    ],
  },
  {
    match: /health|insurance|medical|hsa|hra/i,
    answer: `Sledgewood offers two medical plans through **BlueCross BlueShield**:

- **HSA Plan** — $2,500 individual / $5,000 family deductible. Sledgewood contributes **$1,500 / $3,000** annually to your HSA.
- **Standard HRA Plan** — $750 individual / $1,500 family deductible. Higher premiums but lower out-of-pocket [exposure](doc:health-2026:1).

Both plans include dental and vision at no extra cost. Enrollment is open **November 1 – 30** each [year](doc:health-2026:2).`,
    citations: [
      { fileId: 'health-2026', filename: 'Benefits Guide 2026', page: 1 },
      { fileId: 'health-2026', filename: 'Benefits Guide 2026', page: 2 },
    ],
  },
  {
    match: /holiday|company holiday|days off/i,
    answer: HOLIDAY_MSGS[1].content,
    citations: HOLIDAY_MSGS[1].citations || [],
  },
  {
    match: /referral|employee referral/i,
    answer: `The **Employee Referral Program** pays **$2,000** for successful hires in engineering, product, and design roles, and **$1,000** for other roles. Payout happens after the new hire completes **90 days** of employ[ment](doc:referral:1).

Referrals are submitted through **Workday → Careers → Refer a Friend**. Track your submissions from the same page.`,
    citations: [
      { fileId: 'referral', filename: 'Referral Program Handbook', page: 1 },
    ],
  },
  {
    match: /sledgewood|company|about/i,
    answer: `**Sledgewood Inc.** is a professional services and software company based in Norwell, Massachusetts. Founded in **2004**, it operates from headquarters at 200 Commerce Way with regional offices in **Austin, TX** and **Denver, CO**.

Roughly **60%** of staff work a hybrid schedule; the company employs approximately **420 people** as of Q4 2025.`,
    citations: [],
  },
];

const DEFAULT_ANSWER =
  "I don't have a canned answer for that in this static demo — try one of the suggested prompts or ask about **PTO**, **health insurance**, **company holidays**, **employee referrals**, or **Sledgewood**.";

/** Hover-preview snippets keyed by `${fileId}:${page ?? ''}` */
const CITATION_PREVIEWS: Record<string, CitationPreviewData> = {
  'holiday-2026:1': {
    filename: 'Holiday Schedule 2026',
    page: 1,
    snippet:
      'Sledgewood Inc. observes eleven paid company holidays in calendar year 2026. Offices are closed on the dates listed below.',
    effectiveLabel: 'Effective January 1, 2026',
  },
  'holiday-2026:2': {
    filename: 'Holiday Schedule 2026',
    page: 2,
    snippet:
      'Each employee receives two floating holidays annually. Floating holidays do not carry over and are tracked separately from PTO.',
    effectiveLabel: 'Effective January 1, 2026',
  },
  'holiday-2026:3': {
    filename: 'Holiday Schedule 2026',
    page: 3,
    snippet:
      'When a fixed holiday falls on a Saturday or Sunday, the office observes it on the closest adjacent weekday.',
    effectiveLabel: 'Effective January 1, 2026',
  },
  'pto-policy:1': {
    filename: 'PTO Policy 2026',
    page: 1,
    snippet:
      'Full-time employees accrue 1.67 days of PTO per calendar month in their first two years of continuous service.',
    effectiveLabel: 'Effective January 1, 2026',
  },
  'pto-policy:2': {
    filename: 'PTO Policy 2026',
    page: 2,
    snippet:
      'PTO accrual posts on the last calendar day of each month. Manager approval is required for requests exceeding one work week.',
    effectiveLabel: 'Effective January 1, 2026',
  },
  'health-2026:1': {
    filename: 'Benefits Guide 2026',
    page: 1,
    snippet:
      'HSA Plan carries a $2,500 individual / $5,000 family deductible. Sledgewood contributes $1,500 / $3,000 annually.',
    effectiveLabel: 'Plan Year 2026',
  },
  'health-2026:2': {
    filename: 'Benefits Guide 2026',
    page: 2,
    snippet:
      'Open enrollment runs November 1 through November 30. Coverage becomes effective January 1 of the following year.',
    effectiveLabel: 'Plan Year 2026',
  },
  'referral:1': {
    filename: 'Employee Referral Form',
    page: 1,
    snippet:
      'Rules: Must be a current employee at time of hire. One referrer per candidate. Bonus paid after the 90-day mark.',
    effectiveLabel: 'Effective January 1, 2026',
  },
};

function lookupPreview(
  fileId: string,
  page?: number,
): CitationPreviewData | undefined {
  const exact = CITATION_PREVIEWS[`${fileId}:${page ?? ''}`];
  if (exact) return exact;
  // Fall back to any page for this file
  return Object.entries(CITATION_PREVIEWS).find(([k]) =>
    k.startsWith(`${fileId}:`),
  )?.[1];
}

function pickAnswer(question: string): {
  answer: string;
  citations: MessageCitation[];
} {
  for (const { match, answer, citations } of CANNED_ANSWERS) {
    if (match.test(question)) return { answer, citations };
  }
  return { answer: DEFAULT_ANSWER, citations: [] };
}

export default function DemoPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('demo-2');
  const [messages, setMessages] = useState<Message[]>(HOLIDAY_MSGS);
  const [streaming, setStreaming] = useState<{
    content: string;
    citations: MessageCitation[];
  } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [openCitation, setOpenCitation] = useState<{
    fileId: string;
    page?: number;
    filename?: string;
  } | null>(null);
  const [sourceMaximized, setSourceMaximized] = useState(false);

  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStream = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setStreaming(null);
    setIsThinking(false);
  }, []);

  const startStream = useCallback((question: string) => {
    stopStream();
    const { answer, citations } = pickAnswer(question);

    // Fake "Thinking..." pause
    setIsThinking(true);
    setStreaming({ content: '', citations });

    const thinkingDelay = 500;
    let position = 0;

    const tick = () => {
      // Reveal ~4 chars per tick, 20ms cadence => ~200 chars/s
      position = Math.min(answer.length, position + 4);
      setStreaming({ content: answer.slice(0, position), citations });
      if (position < answer.length) {
        streamTimerRef.current = setTimeout(tick, 18);
      } else {
        // Commit final assistant message
        const assistant: Message = {
          id: `a-${Date.now()}`,
          conversationId: selectedId,
          role: 'assistant',
          content: answer,
          citations: citations.length ? citations : undefined,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistant]);
        setStreaming(null);
        setIsThinking(false);
        streamTimerRef.current = null;
      }
    };

    streamTimerRef.current = setTimeout(() => {
      setIsThinking(false);
      tick();
    }, thinkingDelay);
  }, [selectedId, stopStream]);

  const handleSendMessage = useCallback(
    (content: string) => {
      const user: Message = {
        id: `u-${Date.now()}`,
        conversationId: selectedId,
        role: 'user',
        content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, user]);
      startStream(content);
    },
    [selectedId, startStream],
  );

  const handleSelectConversation = useCallback((c: Conversation) => {
    stopStream();
    setSelectedId(c.id);
    if (c.id === 'demo-2') {
      setMessages(HOLIDAY_MSGS);
    } else {
      setMessages([]);
    }
  }, [stopStream]);

  const handleCreateConversation = useCallback(() => {
    stopStream();
    setSelectedId('demo-1');
    setMessages([]);
  }, [stopStream]);

  const showEmpty = messages.length === 0 && !streaming && !isThinking;
  const currentTitle =
    MOCK_CONVERSATIONS.find((c) => c.id === selectedId)?.title ||
    'New Conversation';

  const activeCitation = openCitation
    ? { fileId: openCitation.fileId, page: openCitation.page }
    : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <CashmanHeader
        appsHref="#"
        fallbackName="Michael"
        fallbackRole="Admin"
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="relative flex h-full w-full"
          style={{ backgroundColor: '#f8f9fa' }}
        >
          <CashmanSidebar
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((v) => !v)}
            conversations={MOCK_CONVERSATIONS}
            currentConversationId={selectedId}
            onSelectConversation={handleSelectConversation}
            onCreateConversation={handleCreateConversation}
          />

          <div
            className="flex min-w-0 flex-1 flex-col"
            style={{
              opacity: sourceMaximized && openCitation ? 0 : 1,
              transition: 'opacity 200ms ease-out',
              width: sourceMaximized && openCitation ? 0 : undefined,
            }}
          >
            <div
              className="flex h-12 items-center border-b bg-white px-6"
              style={{ borderColor: '#ebebeb' }}
            >
              <h1
                className="truncate text-[18px] font-semibold tracking-tight"
                style={{ color: 'var(--cashman-text)' }}
              >
                {currentTitle}
              </h1>
            </div>

            <div className="relative flex flex-1 flex-col overflow-hidden">
              <div data-chat-scroll="1" className="flex-1 overflow-y-auto">
                {showEmpty ? (
                  <CashmanEmptyState onPromptClick={handleSendMessage} />
                ) : (
                  <CashmanMessages
                    messages={messages}
                    streamingContent={streaming?.content}
                    streamingCitations={streaming?.citations}
                    isLoading={isThinking || !!streaming}
                    activeCitation={activeCitation}
                    getCitationPreview={lookupPreview}
                    onCitationClick={(fileId, page) => {
                      const preview = lookupPreview(fileId, page);
                      setOpenCitation({
                        fileId,
                        page,
                        filename: preview?.filename || 'Source Document',
                      });
                    }}
                  />
                )}
              </div>

              <CashmanComposer
                onSend={handleSendMessage}
                onStop={stopStream}
                isStreaming={isThinking || !!streaming}
              />
            </div>
          </div>

          {openCitation && (
            <CashmanSourcePanel
              fileId={openCitation.fileId}
              page={openCitation.page}
              filename={openCitation.filename}
              onClose={() => {
                setOpenCitation(null);
                setSourceMaximized(false);
              }}
              onMaximizedChange={setSourceMaximized}
            />
          )}
        </div>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}
