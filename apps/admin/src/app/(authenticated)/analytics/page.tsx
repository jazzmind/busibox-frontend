'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, Users, MousePointerClick, MessageSquare, ChevronRight, FileText } from 'lucide-react';
import { MiniSparkline } from '@/components/admin/analytics/MiniSparkline';
import { SatisfactionBadge } from '@/components/admin/analytics/SatisfactionBadge';

interface AppUsage {
  app_id: string;
  requests_today: number;
  requests_7d: number;
  requests_30d: number;
  unique_users_today: number;
  unique_users_7d: number;
  unique_users_30d: number;
  daily_trend: Array<{ date: string; requests: number; unique_users: number }>;
}

interface FeedbackSummary {
  app_id: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  satisfaction_score: number;
  recent_comments: Array<{ comment: string; rating: string; created_at: string }>;
}

interface ChatAppUsage {
  app_id: string;
  conversations_total: number;
  conversations_7d: number;
  unique_users_total: number;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary[]>([]);
  const [chatUsage, setChatUsage] = useState<ChatAppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, feedbackRes, chatRes] = await Promise.all([
        fetch(`/api/analytics/apps?days=${days}`),
        fetch(`/api/analytics/feedback`),
        fetch(`/api/analytics/chat?days=${days}`),
      ]);

      const [usageData, feedbackData, chatData] = await Promise.all([
        usageRes.ok ? usageRes.json() : { data: { apps: [] } },
        feedbackRes.ok ? feedbackRes.json() : { data: { feedback: [] } },
        chatRes.ok ? chatRes.json() : { data: { apps: [] } },
      ]);

      // apiSuccess wraps responses in { success, data: { ... } }
      setAppUsage((usageData.data ?? usageData).apps || []);
      setFeedback((feedbackData.data ?? feedbackData).feedback || []);
      setChatUsage((chatData.data ?? chatData).apps || []);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  // Merge app data
  const feedbackByApp = new Map(feedback.map((f) => [f.app_id, f]));
  const chatByApp = new Map(chatUsage.map((c) => [c.app_id, c]));

  const allAppIds = new Set([
    ...appUsage.map((a) => a.app_id),
    ...feedback.map((f) => f.app_id),
  ]);

  const totalUniqueUsers = appUsage.reduce((s, a) => s + a.unique_users_30d, 0);
  const totalRequests = appUsage.reduce((s, a) => s + a.requests_30d, 0);
  const totalConversations = chatUsage.reduce((s, c) => s + c.conversations_total, 0);
  const totalFeedback = feedback.reduce((s, f) => s + f.total, 0);
  const totalPositive = feedback.reduce((s, f) => s + f.positive, 0);
  const totalNegative = feedback.reduce((s, f) => s + f.negative, 0);
  const overallScore =
    totalFeedback > 0
      ? Math.round(((totalPositive - totalNegative) / totalFeedback) * 100 * 10) / 10
      : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">App Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Usage and satisfaction data across all apps
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Link
            href="/analytics/report"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            OKR Report
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Unique Users"
          value={totalUniqueUsers.toLocaleString()}
          sub={`Last ${days} days`}
        />
        <StatCard
          icon={<MousePointerClick className="w-5 h-5" />}
          label="Total Requests"
          value={totalRequests.toLocaleString()}
          sub={`Last ${days} days`}
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Conversations"
          value={totalConversations.toLocaleString()}
          sub={`Last ${days} days`}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Satisfaction Score"
          value={overallScore !== null ? `${overallScore > 0 ? '+' : ''}${overallScore}` : '—'}
          sub={`${totalFeedback} responses`}
        />
      </div>

      {/* Per-App Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Per-App Breakdown</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading…</div>
        ) : allAppIds.size === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No usage data yet. Usage is tracked once apps start generating activity.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium text-right">Today</th>
                  <th className="px-4 py-3 font-medium text-right">7d Users</th>
                  <th className="px-4 py-3 font-medium text-right">30d Users</th>
                  <th className="px-4 py-3 font-medium text-right">30d Requests</th>
                  <th className="px-4 py-3 font-medium text-right">Convs</th>
                  <th className="px-4 py-3 font-medium text-right">Satisfaction</th>
                  <th className="px-4 py-3 font-medium text-center">Trend</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from(allAppIds).map((appId) => {
                  const usage = appUsage.find((a) => a.app_id === appId);
                  const fb = feedbackByApp.get(appId);
                  const chat = chatByApp.get(appId);
                  const trendData = (usage?.daily_trend || []).map((d) => ({
                    value: d.unique_users,
                  }));

                  return (
                    <tr key={appId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{appId}</div>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {usage?.unique_users_today ?? 0}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {usage?.unique_users_7d ?? 0}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {usage?.unique_users_30d ?? 0}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {(usage?.requests_30d ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {chat?.conversations_total ?? 0}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {fb ? (
                          <SatisfactionBadge score={fb.satisfaction_score} size="sm" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <MiniSparkline data={trendData} />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/analytics/${encodeURIComponent(appId)}`}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
