/**
 * Live Dashboard Component
 * 
 * A real-time visualization dashboard with:
 * - Animated activity ticker
 * - Real-time sparkline charts
 * - Live metrics with smooth transitions
 * - Service health monitoring
 * 
 * Supports light and dark modes.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Activity, 
  MessageSquare, 
  FileText, 
  Cpu, 
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  Clock,
  Bot,
  Search,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Radio,
  BarChart3,
} from 'lucide-react';
import { CollapsibleServiceHealth } from './CollapsibleServiceHealth';
import { ModelMemoryCard } from './ModelMemoryCard';
import { GraphStatCard } from './graph/GraphStatCard';
import { useCustomization } from '@jazzmind/busibox-app';

type ActivityEvent = {
  id: string;
  type: 'chat' | 'search' | 'data' | 'agent' | 'login';
  user?: string;
  message: string;
  timestamp: number;
  status: 'success' | 'pending' | 'error';
};

type ModelUsage = {
  model: string;
  requests: number;
  tokens: number;
  avgLatency: number;
};

// Mini Sparkline Chart Component
function Sparkline({ 
  data, 
  color = '#3b82f6', 
  height = 40,
  showArea = true,
}: { 
  data: number[]; 
  color?: string; 
  height?: number;
  showArea?: boolean;
}) {
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M0,${height} L${points} L${width},${height} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {showArea && (
        <path
          d={areaPath}
          fill={`${color}20`}
          className="transition-all duration-500"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
      {/* Latest point indicator */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4)}
        r="3"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
}

// Animated Number Display
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    
    const startValue = prevValue.current;
    const endValue = value;
    const duration = 500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      
      setDisplayValue(Math.round(startValue + (endValue - startValue) * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return <>{prefix}{displayValue.toLocaleString()}{suffix}</>;
}

// Live Activity Ticker
function ActivityTicker({ activities, primaryColor }: { activities: ActivityEvent[]; primaryColor: string }) {
  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'chat': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'search': return <Search className="w-3.5 h-3.5" />;
      case 'data': return <Upload className="w-3.5 h-3.5" />;
      case 'agent': return <Bot className="w-3.5 h-3.5" />;
      case 'login': return <Users className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const getTypeColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'chat': return 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30';
      case 'search': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
      case 'data': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30';
      case 'agent': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30';
      case 'login': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Events will appear here as users interact with the system</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.slice(0, 10).map((activity, index) => (
        <div 
          key={activity.id}
          className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          style={{
            animation: `fadeSlideIn 0.3s ease-out ${index * 0.05}s both`,
          }}
        >
          <span className={`p-1.5 rounded-md flex-shrink-0 ${getTypeColor(activity.type)}`}>
            {getActivityIcon(activity.type)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{activity.message}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {activity.user && activity.user !== 'System' && (
                <span className="truncate max-w-[120px]">{activity.user}</span>
              )}
              <span>{formatTimestamp(activity.timestamp)}</span>
            </div>
          </div>
          {activity.status === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          ) : activity.status === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          ) : (
            <div className="w-3.5 h-3.5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export function LiveDashboard() {
  const { customization } = useCustomization();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [activeSessions, setActiveSessions] = useState(0);
  const [tokensToday, setTokensToday] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Time series data for charts
  const [sessionHistory, setSessionHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [tokenHistory, setTokenHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, activityRes, modelRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/activity/recent'),
        fetch('/api/llm/usage'),
      ]);

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json();
        if (dashboardData.success) {
          const stats = dashboardData.data?.stats;
          if (stats) {
            setActiveSessions(stats.activeSessions || 0);
            // Update session history
            setSessionHistory(prev => [...prev.slice(1), stats.activeSessions || 0]);
          }
        }
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        if (activityData.success && activityData.data) {
          const recentActivity = activityData.data.map((item: any, index: number) => ({
            id: item.id || `activity-${index}`,
            type: mapEventTypeToActivityType(item.eventType),
            user: item.user?.email || 'System',
            message: item.action || item.message || 'Activity',
            timestamp: new Date(item.createdAt).getTime(),
            status: item.status || (item.success ? 'success' : 'error'),
            source: item.source || 'unknown',
          }));
          setActivities(recentActivity.slice(0, 15));
          setTotalConversations(recentActivity.filter((a: ActivityEvent) => a.type === 'chat' || a.type === 'agent').length);
          setTotalDocuments(recentActivity.filter((a: ActivityEvent) => a.type === 'data').length);
        }
      }

      if (modelRes.ok) {
        const modelData = await modelRes.json();
        if (modelData.success && modelData.data) {
          setModelUsage(modelData.data.models || []);
          const newTokens = modelData.data.tokensToday || 0;
          setTokensToday(newTokens);
          setTokenHistory(prev => [...prev.slice(1), newTokens]);
          
          // Calculate avg latency
          const models = modelData.data.models || [];
          if (models.length > 0) {
            const avgLatency = Math.round(models.reduce((sum: number, m: ModelUsage) => sum + m.avgLatency, 0) / models.length);
            setLatencyHistory(prev => [...prev.slice(1), avgLatency]);
          }
        }
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const mapEventTypeToActivityType = (eventType: string): ActivityEvent['type'] => {
    if (eventType?.includes('chat') || eventType?.includes('message')) return 'chat';
    if (eventType?.includes('search')) return 'search';
    if (eventType?.includes('upload') || eventType?.includes('data')) return 'data';
    if (eventType?.includes('agent')) return 'agent';
    if (eventType?.includes('login') || eventType?.includes('auth')) return 'login';
    return 'chat';
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds (each poll triggers multiple token exchanges)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const avgLatency = modelUsage.length > 0 
    ? Math.round(modelUsage.reduce((sum, m) => sum + m.avgLatency, 0) / modelUsage.length)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div 
            className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: `${customization.primaryColor} transparent ${customization.primaryColor} ${customization.primaryColor}` }}
          />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Initializing dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Health Panel */}
      <CollapsibleServiceHealth className="shadow-sm" />

      {/* Main Metrics Banner */}
      <div 
        className="relative overflow-hidden rounded-2xl border"
        style={{ 
          backgroundColor: `${customization.primaryColor}08`,
          borderColor: `${customization.primaryColor}20`,
        }}
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-30">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(90deg, transparent 24%, ${customization.primaryColor}08 25%, ${customization.primaryColor}08 26%, transparent 27%, transparent 74%, ${customization.primaryColor}08 75%, ${customization.primaryColor}08 76%, transparent 77%, transparent),
                linear-gradient(transparent 24%, ${customization.primaryColor}08 25%, ${customization.primaryColor}08 26%, transparent 27%, transparent 74%, ${customization.primaryColor}08 75%, ${customization.primaryColor}08 76%, transparent 77%, transparent)
              `,
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        <div className="relative p-6">
          {/* Header with live indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${customization.primaryColor}20` }}
              >
                <BarChart3 className="w-6 h-6" style={{ color: customization.primaryColor }} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Activity Monitor</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Real-time system metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              <span className="text-green-600 dark:text-green-400 text-xs font-medium">LIVE</span>
              <span className="text-gray-400 text-xs">
                {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </div>
          </div>

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Sessions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                  <Users className="w-4 h-4" style={{ color: customization.primaryColor }} />
                  Active Sessions
                </div>
                <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Live
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                <AnimatedNumber value={activeSessions} />
              </p>
              <div className="h-8">
                <Sparkline data={sessionHistory} color={customization.primaryColor} height={32} />
              </div>
            </div>

            {/* Tokens Today */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Tokens Today
                </div>
                <span className="text-gray-400 text-xs">24h</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {formatNumber(tokensToday)}
              </p>
              <div className="h-8">
                <Sparkline data={tokenHistory} color="#a855f7" height={32} />
              </div>
            </div>

            {/* Conversations */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                  <MessageSquare className="w-4 h-4 text-cyan-500" />
                  Conversations
                </div>
                <span className="text-gray-400 text-xs">Recent</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                <AnimatedNumber value={totalConversations} />
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-cyan-600 dark:text-cyan-400">{modelUsage.length} models active</span>
              </div>
            </div>

            {/* Avg Latency */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                  <Clock className="w-4 h-4 text-green-500" />
                  Avg Response
                </div>
                <span className={`text-xs flex items-center gap-1 ${avgLatency < 500 ? 'text-green-600 dark:text-green-400' : avgLatency < 1000 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {avgLatency < 500 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {avgLatency < 500 ? 'Fast' : avgLatency < 1000 ? 'Normal' : 'Slow'}
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                <AnimatedNumber value={avgLatency} suffix="ms" />
              </p>
              <div className="h-8">
                <Sparkline data={latencyHistory} color="#22c55e" height={32} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Memory Card */}
      <ModelMemoryCard />

      {/* Infrastructure row */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Infrastructure
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GraphStatCard />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: customization.primaryColor }} />
              Activity Feed
            </h3>
            <span className="text-xs text-gray-400 font-mono">REALTIME</span>
          </div>
          
          <div className="p-3 max-h-[350px] overflow-y-auto">
            <ActivityTicker activities={activities} primaryColor={customization.primaryColor} />
          </div>
          
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <a 
              href="/logging" 
              className="text-sm font-medium flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: customization.primaryColor }}
            >
              View all logs <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Model Usage Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-500" />
              Model Usage
            </h3>
            <span className="text-xs text-gray-400 font-mono">24H</span>
          </div>
          
          <div className="p-4 space-y-4">
            {modelUsage.length > 0 ? (
              modelUsage.slice(0, 5).map((model, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[60%]">{model.model}</span>
                    <span className="text-xs text-gray-500 font-mono">{formatNumber(model.tokens)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (model.requests / 100) * 100)}%`,
                        background: `linear-gradient(90deg, ${customization.primaryColor}, ${customization.secondaryColor || customization.primaryColor})`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{model.requests} req</span>
                    <span className={model.avgLatency < 500 ? 'text-green-600 dark:text-green-400' : model.avgLatency < 1000 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                      {model.avgLatency}ms
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Cpu className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No model usage data</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start using AI to see metrics</p>
              </div>
            )}
          </div>

          {/* Quick Stats Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Requests</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatNumber(modelUsage.reduce((sum, m) => sum + m.requests, 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Documents</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  <AnimatedNumber value={totalDocuments} />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
