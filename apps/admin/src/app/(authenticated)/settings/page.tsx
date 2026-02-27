/**
 * Admin Settings Page
 *
 * Unified page for Portal Customization, Data Settings, AI Models, Email, and Bridge with tabs.
 * Tab order: AI Models, Branding, Bridge (absorbing Email), Data Processing
 * Every main tab has a secondary sub-nav bar (same gray bar style) for its sections.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomizationForm } from '@/components/admin/CustomizationForm';
import { DataSettingsForm } from '@/components/admin/DataSettingsForm';
import { AIModelsSettings } from '@/components/admin/AIModelsSettings';
import { EmailSettingsForm, type EmailSettingsData, type ImapSettingsData } from '@/components/admin/EmailSettingsForm';
import { BridgeSettingsForm, type BridgeSettingsData } from '@/components/admin/BridgeSettingsForm';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';
import {
  Palette,
  Cog,
  Cpu,
  Mail,
  RefreshCw,
  Radio,
  Building2,
  Droplets,
  MapPin,
  Phone,
  SlidersHorizontal,
  BarChart2,
  Scissors,
  Timer,
  Activity,
  Map,
  Layers,
  MonitorPlay,
  MessageSquare,
  Hash,
} from 'lucide-react';

type Tab = 'ai-models' | 'branding' | 'bridge' | 'data';
type AISubTab = 'status' | 'mapping' | 'models' | 'playgrounds';
type BrandingSubTab = 'identity' | 'colors' | 'location' | 'contact' | 'advanced';
type BridgeSubTab = 'status' | 'email' | 'signal' | 'telegram' | 'discord' | 'whatsapp';
type DataSubTab = 'features' | 'strategies' | 'chunking' | 'timeouts';

const AI_SUBTABS: { id: AISubTab; icon: React.ElementType; label: string }[] = [
  { id: 'status', icon: Activity, label: 'Status' },
  { id: 'mapping', icon: Map, label: 'Model Mapping' },
  { id: 'models', icon: Layers, label: 'Models & Providers' },
  { id: 'playgrounds', icon: MonitorPlay, label: 'Playgrounds' },
];

const BRANDING_SUBTABS: { id: BrandingSubTab; icon: React.ElementType; label: string }[] = [
  { id: 'identity', icon: Building2, label: 'Identity' },
  { id: 'colors', icon: Droplets, label: 'Colors' },
  { id: 'location', icon: MapPin, label: 'Location' },
  { id: 'contact', icon: Phone, label: 'Contact' },
  { id: 'advanced', icon: SlidersHorizontal, label: 'Advanced' },
];

const BRIDGE_SUBTABS: { id: BridgeSubTab; icon: React.ElementType; label: string }[] = [
  { id: 'status', icon: Activity, label: 'Status' },
  { id: 'email', icon: Mail, label: 'Email' },
  { id: 'signal', icon: Radio, label: 'Signal' },
  { id: 'telegram', icon: MessageSquare, label: 'Telegram' },
  { id: 'discord', icon: Hash, label: 'Discord' },
  { id: 'whatsapp', icon: Phone, label: 'WhatsApp' },
];

const DATA_SUBTABS: { id: DataSubTab; icon: React.ElementType; label: string }[] = [
  { id: 'features', icon: Layers, label: 'Features' },
  { id: 'strategies', icon: BarChart2, label: 'Strategies' },
  { id: 'chunking', icon: Scissors, label: 'Chunking' },
  { id: 'timeouts', icon: Timer, label: 'Timeouts' },
];

export default function AdminSettingsPage() {
  const { user } = useSession();
  const router = useRouter();
  const { customization } = useCustomization();
  const resolve = useCrossAppApiPath();
  const [customizationData, setCustomizationData] = useState<any>(null);
  const [dataSettings, setDataSettings] = useState<any>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsData | null>(null);
  const [emailActiveProvider, setEmailActiveProvider] = useState<string>('none');
  const [bridgeSettings, setBridgeSettings] = useState<BridgeSettingsData | null>(null);
  const [bridgeHealth, setBridgeHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Tab state (synced to ?tab=) ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (t === 'ai-models' || t === 'branding' || t === 'bridge' || t === 'data') return t;
      if (t === 'chat') return 'ai-models';
      if (t === 'email') return 'bridge';
    }
    return 'ai-models';
  });

  // ── Sub-tab state (one per main tab) ────────────────────────────────────────
  const [aiSubTab, setAISubTab] = useState<AISubTab>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('section');
      if (s === 'mapping' || s === 'models' || s === 'playgrounds') return s;
    }
    return 'status';
  });

  const [brandingSubTab, setBrandingSubTab] = useState<BrandingSubTab>('identity');
  const [bridgeSubTab, setBridgeSubTab] = useState<BridgeSubTab>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('section');
      if (s === 'email') return 'email';
    }
    return 'status';
  });
  const [dataSubTab, setDataSubTab] = useState<DataSubTab>('features');

  // ── URL sync helpers ─────────────────────────────────────────────────────────
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

  const handleSetAISubTab = (s: AISubTab) => {
    setAISubTab(s);
    syncUrl('ai-models', s);
  };
  const handleSetBrandingSubTab = (s: BrandingSubTab) => setBrandingSubTab(s);
  const handleSetBridgeSubTab = (s: BridgeSubTab) => {
    setBridgeSubTab(s);
    syncUrl('bridge', s);
  };
  const handleSetDataSubTab = (s: DataSubTab) => setDataSubTab(s);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { window.location.href = '/portal/login'; return; }
    if (!user.roles?.includes('Admin')) { window.location.href = '/portal/home'; return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customizationRes, dataRes, emailRes, bridgeRes] = await Promise.all([
        fetch(resolve('portal-customization', '/api/portal-customization')),
        fetch('/api/data-settings'),
        fetch('/api/email-settings'),
        fetch('/api/bridge-settings'),
      ]);
      if (customizationRes.ok) {
        const data = await customizationRes.json();
        setCustomizationData(data.data?.customization || null);
      }
      if (dataRes.ok) {
        const d = await dataRes.json();
        setDataSettings(d.data || null);
      }
      if (emailRes.ok) {
        const e = await emailRes.json();
        setEmailSettings(e.data?.config || null);
        setEmailActiveProvider(e.data?.activeProvider || 'none');
      }
      if (bridgeRes.ok) {
        const b = await bridgeRes.json();
        setBridgeSettings(b.data?.config || null);
        setBridgeHealth(b.data?.bridgeHealth || null);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // ── Style helpers ────────────────────────────────────────────────────────────
  const tabStyle = (tab: Tab) =>
    activeTab === tab ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined;

  const subStyle = (active: boolean) =>
    active ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined;

  // ── Shared sub-nav bar renderer ──────────────────────────────────────────────
  function SubNav<T extends string>({
    tabs,
    active,
    onSelect,
  }: {
    tabs: { id: T; icon: React.ElementType; label: string }[];
    active: T;
    onSelect: (id: T) => void;
  }) {
    return (
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6" aria-label="Section tabs">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={`flex items-center gap-1.5 py-3 border-b-2 font-medium text-sm transition-colors ${
                  active === id
                    ? 'border-current'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={subStyle(active === id)}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    );
  }

  // ── Section header banner ─────────────────────────────────────────────────────
  const SectionBanner = ({ title, desc }: { title: string; desc: string | React.ReactNode }) => (
    <div
      className="mb-6 rounded-xl p-4 border"
      style={{
        backgroundColor: `${customization.primaryColor}10`,
        borderColor: `${customization.primaryColor}30`,
      }}
    >
      <h3 className="text-sm font-semibold mb-1" style={{ color: customization.primaryColor }}>{title}</h3>
      <div className="text-sm" style={{ color: customization.primaryColor, opacity: 0.8 }}>{desc}</div>
    </div>
  );

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
              <p className="text-gray-600 mt-1">Configure AI models, branding, integrations, and data processing</p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Primary Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8" aria-label="Settings tabs">
            {([
              { id: 'ai-models' as Tab, icon: Cpu, label: 'AI Models' },
              { id: 'branding' as Tab, icon: Palette, label: 'Branding' },
              { id: 'bridge' as Tab, icon: Radio, label: 'Bridge' },
              { id: 'data' as Tab, icon: Cog, label: 'Data Processing' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleSetTab(id)}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? 'border-current'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={tabStyle(id)}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Secondary Sub-Nav (same gray bar for every tab) */}
      {activeTab === 'ai-models' && (
        <SubNav tabs={AI_SUBTABS} active={aiSubTab} onSelect={handleSetAISubTab} />
      )}
      {activeTab === 'branding' && (
        <SubNav tabs={BRANDING_SUBTABS} active={brandingSubTab} onSelect={handleSetBrandingSubTab} />
      )}
      {activeTab === 'bridge' && (
        <SubNav tabs={BRIDGE_SUBTABS} active={bridgeSubTab} onSelect={handleSetBridgeSubTab} />
      )}
      {activeTab === 'data' && (
        <SubNav tabs={DATA_SUBTABS} active={dataSubTab} onSelect={handleSetDataSubTab} />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading && activeTab !== 'ai-models' ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto" style={{ color: customization.primaryColor }} />
            <p className="mt-4 text-gray-600">Loading settings...</p>
          </div>
        ) : (
          <>
            {/* ── AI Models ──────────────────────────────────────────────────────── */}
            {activeTab === 'ai-models' && (
              <AIModelsSettings section={aiSubTab} />
            )}

            {/* ── Branding ───────────────────────────────────────────────────────── */}
            {activeTab === 'branding' && (
              <div>
                {brandingSubTab === 'identity' && (
                  <SectionBanner title="Identity" desc="Set your company name, logo, slogan, and favicon." />
                )}
                {brandingSubTab === 'colors' && (
                  <SectionBanner title="Color Scheme" desc="Choose primary and secondary colors for the portal." />
                )}
                {brandingSubTab === 'location' && (
                  <SectionBanner title="Location" desc="Provide your company address details." />
                )}
                {brandingSubTab === 'contact' && (
                  <SectionBanner title="Contact Information" desc="Public phone, email, and website for the portal footer." />
                )}
                {brandingSubTab === 'advanced' && (
                  <SectionBanner title="Advanced" desc="Custom CSS overrides and other advanced branding options." />
                )}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {customizationData ? (
                    <CustomizationForm customization={customizationData} section={brandingSubTab} />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Loading branding settings...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Bridge ─────────────────────────────────────────────────────────── */}
            {activeTab === 'bridge' && bridgeSubTab === 'status' && (
              <div>
                <SectionBanner
                  title="Bridge Status"
                  desc="Runtime health flags, default agent routing, and connectivity tests."
                />
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {bridgeSettings ? (
                    <BridgeSettingsForm
                      settings={bridgeSettings}
                      bridgeHealth={bridgeHealth}
                      section="status"
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Loading bridge settings...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'bridge' && bridgeSubTab === 'email' && (
              <div>
                <SectionBanner
                  title="Email"
                  desc="Configure outbound delivery (SMTP/Resend) and inbound polling (IMAP) for the bridge."
                />
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {emailSettings ? (
                    <EmailSettingsForm
                      settings={emailSettings}
                      activeProvider={emailActiveProvider}
                      imapSettings={bridgeSettings ? {
                        emailInboundEnabled: (bridgeSettings as any).emailInboundEnabled ?? false,
                        imapHost: (bridgeSettings as any).imapHost ?? null,
                        imapPort: (bridgeSettings as any).imapPort ?? null,
                        imapUser: (bridgeSettings as any).imapUser ?? null,
                        imapPassword: (bridgeSettings as any).imapPassword ?? null,
                        imapUseSsl: (bridgeSettings as any).imapUseSsl ?? true,
                        imapFolder: (bridgeSettings as any).imapFolder ?? null,
                        emailInboundPollInterval: (bridgeSettings as any).emailInboundPollInterval ?? null,
                        emailAllowedSenders: (bridgeSettings as any).emailAllowedSenders ?? null,
                      } as ImapSettingsData : null}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Loading email settings...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'bridge' && (bridgeSubTab === 'signal' || bridgeSubTab === 'telegram' || bridgeSubTab === 'discord' || bridgeSubTab === 'whatsapp') && (
              <div>
                <SectionBanner
                  title={`${bridgeSubTab.charAt(0).toUpperCase()}${bridgeSubTab.slice(1)} Channel`}
                  desc={`Configure credentials and settings for the ${bridgeSubTab} bridge channel.`}
                />
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {bridgeSettings ? (
                    <BridgeSettingsForm
                      settings={bridgeSettings}
                      bridgeHealth={bridgeHealth}
                      section={bridgeSubTab}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Loading bridge settings...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Data Processing ────────────────────────────────────────────────── */}
            {activeTab === 'data' && (
              <div>
                {dataSubTab === 'features' && (
                  <SectionBanner title="Processing Features" desc="Enable or disable extraction and processing capabilities." />
                )}
                {dataSubTab === 'strategies' && (
                  <SectionBanner title="Processing Strategies" desc="Choose between Simple, Marker, ColPali, or multi-flow strategies." />
                )}
                {dataSubTab === 'chunking' && (
                  <SectionBanner title="Chunking Configuration" desc="Control how documents are split for embedding and retrieval." />
                )}
                {dataSubTab === 'timeouts' && (
                  <SectionBanner title="Processing Timeouts" desc="Set timeouts for each processing stage to prevent stalls." />
                )}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {dataSettings ? (
                    <DataSettingsForm settings={dataSettings} section={dataSubTab} />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Loading data settings...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
