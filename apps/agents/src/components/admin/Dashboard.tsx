'use client';

import { useState, useEffect } from 'react';

interface SystemStats {
  totalClients: number;
  totalAgents: number;
  totalWorkflows: number;
  totalTools: number;
  activeConnections: number;
  uptime: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalClients: 0,
    totalAgents: 0,
    totalWorkflows: 0,
    totalTools: 0,
    activeConnections: 0,
    uptime: '0m'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading stats
    const timer = setTimeout(() => {
      setStats({
        totalClients: 12,
        totalAgents: 8,
        totalWorkflows: 15,
        totalTools: 23,
        activeConnections: 4,
        uptime: '2h 34m'
      });
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const StatCard = ({ title, value, icon, color, change }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    change?: string;
  }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 group hover:scale-105">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {loading ? (
              <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              value
            )}
          </div>
          {change && (
            <p className="text-sm text-green-600 mt-1 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {change}
            </p>
          )}
        </div>
        <div className={`text-4xl p-4 rounded-xl bg-gradient-to-r ${color} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const RecentActivity = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {[
          { type: 'agent', message: 'Weather Agent updated', time: '2 minutes ago', icon: '🤖' },
          { type: 'workflow', message: 'Document Analysis workflow created', time: '15 minutes ago', icon: '⚡' },
          { type: 'client', message: 'New client registered: web-app-1', time: '1 hour ago', icon: '👥' },
          { type: 'tool', message: 'Email tool deployed', time: '2 hours ago', icon: '🛠️' },
        ].map((activity, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="text-2xl">{activity.icon}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{activity.message}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const SystemHealth = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
      <div className="space-y-4">
        {[
          { name: 'API Server', status: 'healthy', uptime: '99.9%', color: 'bg-green-500' },
          { name: 'Database', status: 'healthy', uptime: '99.8%', color: 'bg-green-500' },
          { name: 'Authentication', status: 'healthy', uptime: '99.9%', color: 'bg-green-500' },
          { name: 'RAG Service', status: 'degraded', uptime: '97.2%', color: 'bg-yellow-500' },
        ].map((service, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${service.color} animate-pulse`}></div>
              <span className="font-medium text-gray-900">{service.name}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 capitalize">{service.status}</p>
              <p className="text-xs text-gray-500">{service.uptime}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const QuickActions = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'New Agent', icon: '🤖', color: 'from-blue-500 to-blue-600' },
          { label: 'New Workflow', icon: '⚡', color: 'from-purple-500 to-purple-600' },
          { label: 'Add Tool', icon: '🛠️', color: 'from-green-500 to-green-600' },
          { label: 'Import Data', icon: '📚', color: 'from-orange-500 to-orange-600' },
        ].map((action, index) => (
          <button
            key={index}
            className={`flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-r ${action.color} text-white hover:shadow-lg transition-all duration-200 hover:scale-105`}
          >
            <span className="text-2xl mb-1">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome back, Admin! 👋</h1>
        <p className="text-blue-100">Your agent system is running smoothly. Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Clients"
          value={stats.totalClients}
          icon="👥"
          color="from-blue-500 to-blue-600"
          change="+2 this week"
        />
        <StatCard
          title="AI Agents"
          value={stats.totalAgents}
          icon="🤖"
          color="from-purple-500 to-purple-600"
          change="+3 this month"
        />
        <StatCard
          title="Workflows"
          value={stats.totalWorkflows}
          icon="⚡"
          color="from-green-500 to-green-600"
          change="+5 this month"
        />
        <StatCard
          title="Tools Available"
          value={stats.totalTools}
          icon="🛠️"
          color="from-orange-500 to-orange-600"
          change="+1 this week"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />
          
          {/* Performance Chart Placeholder */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API Usage Trends</h3>
            <div className="h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm">Charts coming soon...</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SystemHealth />
          <QuickActions />
          
          {/* Connection Status */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Connections</h3>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">{stats.activeConnections}</div>
              <p className="text-sm text-gray-600">Active connections</p>
              <div className="mt-4 flex justify-center">
                <div className="flex space-x-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-8 rounded-full ${
                        i < stats.activeConnections ? 'bg-green-500' : 'bg-gray-200'
                      } animate-pulse`}
                      style={{ animationDelay: `${i * 200}ms` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
