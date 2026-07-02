/**
 * Admin AI Page
 *
 * Top-level page for LLM configuration, model routing, providers, playgrounds,
 * and coding-agent (Claude Code / OpenCode / Hermes / Pi) integration.
 * Split out of the generic Settings page since AI is now a first-class,
 * frequently-managed admin surface.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AIModelsSettings } from '@/components/admin/ai/AIModelsSettings';
import { CodingAgentsSettings, CODING_AGENTS_SUBTABS, type CodingAgentsSection } from '@/components/admin/ai/CodingAgentsSettings';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TabNav, SubNav } from '@/components/admin/TabNav';
import {
  Activity,
  Map,
  Layers,
  MonitorPlay,
  Bot,
} from 'lucide-react';

type Tab = 'status' | 'mapping' | 'models' | 'playgrounds' | 'coding-agents';

const PRIMARY_TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'status', icon: Activity, label: 'Status' },
  { id: 'mapping', icon: Map, label: 'Model Mapping' },
  { id: 'models', icon: Layers, label: 'Models & Providers' },
  { id: 'playgrounds', icon: MonitorPlay, label: 'Playgrounds' },
  { id: 'coding-agents', icon: Bot, label: 'Coding Agents' },
];

export default function AdminAIPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'status' || t === 'mapping' || t === 'models' || t === 'playgrounds' || t === 'coding-agents') return t;
    }
    return 'status';
  });

  const [codingAgentsSubTab, setCodingAgentsSubTab] = useState<CodingAgentsSection>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('section');
      if (s === 'routing' || s === 'guardrails' || s === 'agent-keys' || s === 'usage') return s;
    }
    return 'overview';
  });

  const syncUrl = (tab: Tab, section?: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    if (section) params.set('section', section);
    else params.delete('section');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSetTab = (tab: Tab) => {
    setActiveTab(tab);
    syncUrl(tab);
  };

  const handleSetCodingAgentsSubTab = (s: CodingAgentsSection) => {
    setCodingAgentsSubTab(s);
    syncUrl('coding-agents', s);
  };

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">AI</h1>
          <p className="text-gray-600 mt-1">Configure models, routing, providers, and coding agent integrations</p>
        </div>
      </div>

      {/* Primary Tab Bar */}
      <TabNav tabs={PRIMARY_TABS} active={activeTab} onSelect={handleSetTab} />

      {/* Secondary Sub-Nav for Coding Agents */}
      {activeTab === 'coding-agents' && (
        <SubNav tabs={CODING_AGENTS_SUBTABS} active={codingAgentsSubTab} onSelect={handleSetCodingAgentsSubTab} />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'coding-agents' ? (
          <ErrorBoundary fallbackMessage="Coding Agents settings encountered an error. Check the browser console for details.">
            <CodingAgentsSettings section={codingAgentsSubTab} />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary fallbackMessage="AI settings encountered an error. Check the browser console for details.">
            <AIModelsSettings section={activeTab} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
