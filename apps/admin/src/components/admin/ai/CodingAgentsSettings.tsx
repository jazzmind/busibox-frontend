/**
 * Coding Agents settings — configure & monitor LiteLLM routing for coding
 * agents (Claude Code, OpenCode, Hermes, Pi). Backend endpoints for
 * agent-key issuance and per-agent usage are not built yet; this component
 * renders real data where an endpoint already exists (Routing preview via
 * /api/llm-purposes, Usage via /api/llm/usage) and clear "coming soon"
 * panels for the rest so the tab isn't a dead stub.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Route,
  Shield,
  Key,
  TrendingUp,
  LayoutDashboard,
  Bot,
} from 'lucide-react';
import { Sparkline, AnimatedNumber } from '../Sparkline';

export type CodingAgentsSection = 'overview' | 'routing' | 'guardrails' | 'agent-keys' | 'usage';

const CODE_PURPOSE_LABELS: Record<string, string> = {
  'code-reading': 'Code Reading (repo scanning, symbol lookup)',
  'code-writing': 'Code Writing (codegen, refactoring)',
  'code-testing': 'Code Testing (unit/integration tests)',
  'code-documenting': 'Code Documentation (READMEs, docstrings)',
  'code-planning': 'Code Planning (architecture, design review)',
  'code-securing': 'Code Security (vulnerability review)',
};

const KNOWN_AGENTS = [
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'opencode', name: 'OpenCode' },
  { id: 'hermes', name: 'Hermes Agent' },
  { id: 'pi-dev', name: 'Pi' },
];

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">{desc}</p>
    </div>
  );
}

function OverviewSection() {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KNOWN_AGENTS.map((agent) => (
          <div key={agent.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{agent.name}</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Not configured
            </span>
          </div>
        ))}
      </div>
      <ComingSoon
        title="Agent configuration coming soon"
        desc="Once virtual keys are wired up (Agent Keys tab), each coding agent's connection status, last-used time, and current purpose/model routing will appear here."
      />
    </div>
  );
}

function RoutingSection() {
  const [purposes, setPurposes] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/llm-purposes', { headers: { 'X-Quiet-Logs': '1' } });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setPurposes(json.data?.purposes || {});
        }
      } catch (e) {
        console.error('Failed to fetch purposes:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const codePurposeEntries = Object.entries(CODE_PURPOSE_LABELS).map(([id, label]) => ({
    id,
    label,
    model: purposes?.[id],
  }));
  const anyConfigured = codePurposeEntries.some((p) => p.model);

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-6">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
          </div>
        ) : (
          codePurposeEntries.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">{p.label}</span>
              {p.model ? (
                <span className="text-sm font-mono text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{p.model}</span>
              ) : (
                <span className="text-sm text-gray-400">not routed</span>
              )}
            </div>
          ))
        )}
      </div>
      {!loading && !anyConfigured && (
        <ComingSoon
          title="Coding-task routing not yet wired up"
          desc="The six code-* purposes above aren't yet accepted by the purpose-mapping API. Once that lands, tasks will route by difficulty — fast/local for repo scanning, mid-tier local for writing/testing/docs, frontier for planning/security review."
        />
      )}
    </div>
  );
}

function GuardrailsSection() {
  return (
    <ComingSoon
      title="Guardrails coming soon"
      desc="Per-agent budgets and rate limits (set when a virtual key is issued in Agent Keys), plus secret-detection and prompt-injection hooks for requests that leave the network to frontier models."
    />
  );
}

function AgentKeysSection() {
  return (
    <ComingSoon
      title="Agent Keys coming soon"
      desc="Issue a scoped LiteLLM virtual key per coding agent (replacing the shared master key), restricted to the code-* purposes, with its own budget and rate limit. Revoke access per developer/agent without affecting anyone else."
    />
  );
}

type UsageModel = { model: string; requests: number; tokens: number; spend: number; avgLatency: number };

function UsageSection() {
  const [models, setModels] = useState<UsageModel[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [tokensToday, setTokensToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/llm/usage');
        if (res.ok) {
          const json = await res.json();
          const data = json.data || {};
          if (!cancelled) {
            setModels(data.models || []);
            setTotalSpend(data.totalSpend || 0);
            setTokensToday(data.tokensToday || 0);
          }
        }
      } catch (e) {
        console.error('Failed to fetch usage:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
        Showing overall LLM usage across all callers. Breakdown by coding agent will appear here once
        virtual keys (Agent Keys tab) are issued and usage can be attributed per agent.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Tokens Today</p>
          <p className="text-2xl font-bold text-gray-900"><AnimatedNumber value={tokensToday} /></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Spend (30d)</p>
          <p className="text-2xl font-bold text-gray-900">${totalSpend.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Trend</p>
          <Sparkline data={models.map((m) => m.requests)} color="#6366f1" height={32} />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((m) => (
                <tr key={m.model}>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{m.model}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{m.requests}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{m.tokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">${m.spend.toFixed(4)}</td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No usage data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function CodingAgentsSettings({ section = 'overview' }: { section?: CodingAgentsSection }) {
  if (section === 'routing') return <RoutingSection />;
  if (section === 'guardrails') return <GuardrailsSection />;
  if (section === 'agent-keys') return <AgentKeysSection />;
  if (section === 'usage') return <UsageSection />;
  return <OverviewSection />;
}

export const CODING_AGENTS_SUBTABS: { id: CodingAgentsSection; icon: React.ElementType; label: string }[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'routing', icon: Route, label: 'Routing' },
  { id: 'guardrails', icon: Shield, label: 'Guardrails' },
  { id: 'agent-keys', icon: Key, label: 'Agent Keys' },
  { id: 'usage', icon: TrendingUp, label: 'Usage' },
];
