/**
 * Account Settings Page
 * 
 * User account settings including passkey management.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, UserAvatar } from '@jazzmind/busibox-app';
import { PasskeySettings } from '@/components/auth/PasskeySettings';
import { ChannelLinkingSettings } from '@jazzmind/busibox-app/components/account/ChannelLinkingSettings';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';

interface AccountProfile {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  favorite_color?: string;
  has_github_pat?: boolean;
}

export default function AccountPage() {
  const { user, loading, refreshSession, updateUser } = useSession();
  const router = useRouter();
  const { customization } = useCustomization();
  const [profile, setProfile] = useState<AccountProfile>({
    display_name: '',
    first_name: '',
    last_name: '',
    avatar_url: '',
    favorite_color: '#6366f1',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [githubPat, setGithubPat] = useState('');
  const [clearGithubPat, setClearGithubPat] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) return;
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/account/profile', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const payload = data.profile || {};
        setProfile({
          display_name: payload.display_name || payload.displayName || '',
          first_name: payload.first_name || payload.firstName || '',
          last_name: payload.last_name || payload.lastName || '',
          avatar_url: payload.avatar_url || payload.avatarUrl || '',
          favorite_color: payload.favorite_color || payload.favoriteColor || '#6366f1',
          has_github_pat: Boolean(payload.has_github_pat),
        });
      } catch {
        // keep defaults if profile lookup fails
      }
    };
    void loadProfile();
  }, [loading, user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          github_pat: githubPat || undefined,
          clear_github_pat: clearGithubPat || undefined,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to save profile');
      }
      const data = await response.json();
      setProfileMessage('Profile updated');
      setGithubPat('');
      setClearGithubPat(false);
      // Immediately update the session context so the navbar reflects changes.
      // This is instant -- no server round-trip needed.
      updateUser({
        displayName: profile.display_name || undefined,
        firstName: profile.first_name || undefined,
        lastName: profile.last_name || undefined,
        avatarUrl: profile.avatar_url || undefined,
        favoriteColor: profile.favorite_color || undefined,
      });
      // If the server successfully refreshed the session JWT cookie,
      // re-fetch the session so the context is backed by the new JWT.
      // If not, skip the refresh to avoid overwriting updateUser() with stale JWT claims.
      if (data.sessionRefreshed) {
        await refreshSession();
      }
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="border-b shadow-sm"
        style={{ 
          backgroundColor: customization.primaryColor,
          borderColor: customization.secondaryColor 
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-2xl font-bold tracking-wide"
                style={{ color: customization.textColor }}
              >
                Account Settings
              </h1>
              <p 
                className="mt-1 text-sm opacity-80"
                style={{ color: customization.textColor }}
              >
                Manage your account and sign-in options
              </p>
            </div>
            
            <Link href="/home">
              <Button variant="secondary">
                ← Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>

          <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <UserAvatar
                size="lg"
                name={profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email}
                email={user.email}
                avatarUrl={profile.avatar_url}
                favoriteColor={profile.favorite_color}
              />
              <div>
                <p className="text-sm text-gray-500">Profile Preview</p>
                <p className="font-medium text-gray-900">
                  {profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email}
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Email</span>
              <span className="font-medium text-gray-900">{user.email}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Account Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
            
            {user.roles && user.roles.length > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Roles</span>
                <div className="flex gap-2">
                  {user.roles.map((role: string) => (
                    <span
                      key={role}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                <input
                  value={profile.first_name || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, first_name: e.target.value }))}
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                <input
                  value={profile.last_name || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, last_name: e.target.value }))}
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
              <input
                value={profile.display_name || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, display_name: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Avatar URL</label>
              <input
                value={profile.avatar_url || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="https://..."
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Favorite Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={profile.favorite_color || '#6366f1'}
                  onChange={(e) => setProfile((prev) => ({ ...prev, favorite_color: e.target.value }))}
                  className="h-9 w-12 border border-gray-300 rounded-md bg-white p-1 cursor-pointer"
                />
                <input
                  value={profile.favorite_color || '#6366f1'}
                  onChange={(e) => setProfile((prev) => ({ ...prev, favorite_color: e.target.value }))}
                  placeholder="#6366f1"
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </Button>
              {profileMessage ? <span className="text-sm text-gray-600">{profileMessage}</span> : null}
            </div>
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">GitHub Access Token</h3>
              <p className="text-xs text-gray-500">
                Used by App Builder for repository sync and library publishing.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Personal Access Token</label>
                <input
                  type="password"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder={profile.has_github_pat ? 'Token saved (enter new token to replace)' : 'ghp_...'}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={clearGithubPat}
                  onChange={(e) => setClearGithubPat(e.target.checked)}
                />
                Remove saved token
              </label>
            </div>
          </div>
        </div>

        {/* Passkey Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <PasskeySettings />
        </div>

        {/* Channel Linking Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <ChannelLinkingSettings />
        </div>
      </main>
    </div>
  );
}




