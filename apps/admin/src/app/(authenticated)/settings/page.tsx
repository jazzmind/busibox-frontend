/**
 * Admin Settings Page
 *
 * Unified page for Portal Customization, Email, and Bridge with tabs.
 * Tab order: Branding, Bridge (absorbing Email), Integrations
 * Every main tab has a secondary sub-nav bar (same gray bar style) for its sections.
 *
 * AI Models moved to /ai (see ai/page.tsx). Data Processing moved to /data (see
 * data/page.tsx, "Processing" tab). Both are redirected here for old bookmarks.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomizationForm } from '@/components/admin/CustomizationForm';
import { EmailSettingsForm, type EmailSettingsData, type ImapSettingsData } from '@/components/admin/EmailSettingsForm';
import { BridgeSettingsForm, type BridgeSettingsData } from '@/components/admin/BridgeSettingsForm';
import { OAuthSettingsForm } from '@/components/admin/OAuthSettingsForm';
import { TabNav, SubNav, SectionBanner } from '@/components/admin/TabNav';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';
import {
  Palette,
  Mail,
  RefreshCw,
  Radio,
  Building2,
  Droplets,
  MapPin,
  Phone,
  SlidersHorizontal,
  Activity,
  MessageSquare,
  Hash,
  Link,
} from 'lucide-react';

type Tab = 'branding' | 'bridge' | 'integrations';
type BrandingSubTab = 'identity' | 'colors' | 'location' | 'contact' | 'advanced';
type BridgeSubTab = 'status' | 'email' | 'signal' | 'telegram' | 'discord' | 'whatsapp';

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

export default function AdminSettingsPage() {
  const { user } = useSession();
  const router = useRouter();
  const { customization } = useCustomization();
  const resolve = useCrossAppApiPath();
  const [customizationData, setCustomizationData] = useState<any>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsData | null>(null);
  const [emailActiveProvider, setEmailActiveProvider] = useState<string>('none');
  const [bridgeSettings, setBridgeSettings] = useState<BridgeSettingsData | null>(null);
  const [bridgeHealth, setBridgeHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Legacy redirects: AI Models and Data Processing moved to their own pages ──
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab');
    if (t === 'ai-models') {
      const section = p.get('section');
      router.replace(`/ai${section ? `?tab=${section}` : ''}`);
    } else if (t === 'data') {
      const section = p.get('section');
      router.replace(`/data?tab=processing${section ? `&section=${section}` : ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab state (synced to ?tab=) ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (t === 'branding' || t === 'bridge' || t === 'integrations') return t;
      if (t === 'chat') return 'branding';
      if (t === 'email') return 'bridge';
    }
    return 'branding';
  });

  // ── Sub-tab state (one per main tab) ────────────────────────────────────────
  const [brandingSubTab, setBrandingSubTab] = useState<BrandingSubTab>('identity');
  const [bridgeSubTab, setBridgeSubTab] = useState<BridgeSubTab>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('section');
      if (s === 'email') return 'email';
    }
    return 'status';
  });

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

  const handleSetBrandingSubTab = (s: BrandingSubTab) => setBrandingSubTab(s);
  const handleSetBridgeSubTab = (s: BridgeSubTab) => {
    setBridgeSubTab(s);
    syncUrl('bridge', s);
  };

  // ── Fetch data when user is available ────────────────────────────────────────
  // Auth/admin redirect is handled by ProtectedRoute in the layout.
  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customizationRes, emailRes, bridgeRes] = await Promise.all([
        fetch(resolve('portal-customization', '/api/portal-customization')),
        fetch('/api/email-settings'),
        fetch('/api/bridge-settings'),
      ]);
      if (customizationRes.ok) {
        const data = await customizationRes.json();
        setCustomizationData(data.data?.customization || null);
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

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
              <p className="text-gray-600 mt-1">Configure branding, integrations, and messaging bridges</p>
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
      <TabNav
        tabs={[
          { id: 'branding', icon: Palette, label: 'Branding' },
          { id: 'bridge', icon: Radio, label: 'Bridge' },
          { id: 'integrations', icon: Link, label: 'Integrations' },
        ]}
        active={activeTab}
        onSelect={handleSetTab}
      />

      {/* Secondary Sub-Nav (same gray bar for every tab) */}
      {activeTab === 'branding' && (
        <SubNav tabs={BRANDING_SUBTABS} active={brandingSubTab} onSelect={handleSetBrandingSubTab} />
      )}
      {activeTab === 'bridge' && (
        <SubNav tabs={BRIDGE_SUBTABS} active={bridgeSubTab} onSelect={handleSetBridgeSubTab} />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto" style={{ color: customization.primaryColor }} />
            <p className="mt-4 text-gray-600">Loading settings...</p>
          </div>
        ) : (
          <>
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
                        emailInboundProtocol: (bridgeSettings as any).emailInboundProtocol ?? 'imap',
                        imapHost: (bridgeSettings as any).imapHost ?? null,
                        imapPort: (bridgeSettings as any).imapPort ?? null,
                        imapUser: (bridgeSettings as any).imapUser ?? null,
                        imapPassword: (bridgeSettings as any).imapPassword ?? null,
                        imapUseSsl: (bridgeSettings as any).imapUseSsl ?? true,
                        imapFolder: (bridgeSettings as any).imapFolder ?? null,
                        emailInboundPollInterval: (bridgeSettings as any).emailInboundPollInterval ?? null,
                        emailAllowedSenders: (bridgeSettings as any).emailAllowedSenders ?? null,
                        emailAgentId: (bridgeSettings as any).emailAgentId ?? null,
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

            {/* ── OAuth Integrations ─────────────────────────────────────────────── */}
            {activeTab === 'integrations' && (
              <div>
                <SectionBanner
                  title="OAuth Integrations"
                  desc="Configure Google and Microsoft OAuth apps so users can connect their personal accounts for calendar and email access by AI agents."
                />
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <OAuthSettingsForm />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
