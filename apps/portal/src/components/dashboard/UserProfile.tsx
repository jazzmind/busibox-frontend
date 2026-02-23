/**
 * User Profile Component
 * 
 * Displays user information and logout button.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Button } from '@jazzmind/busibox-app';

export function UserProfile() {
  const { user } = useSession();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/login');
      } else {
        console.error('Logout failed');
        setLoggingOut(false);
      }
    } catch (error) {
      console.error('Logout error:', error);
      setLoggingOut(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
            <span className="text-xl font-bold text-white">
              {user.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{user.email}</h3>
            <p className="text-sm text-gray-600">
              {user.roles && user.roles.length > 0 ? user.roles.join(', ') : 'No roles assigned'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className={`font-medium ${
            user.status === 'ACTIVE' ? 'text-green-600' : 
            user.status === 'PENDING' ? 'text-yellow-600' : 
            'text-red-600'
          }`}>
            {user.status}
          </span>
        </div>
        {/* Last login info would come from API if needed */}
      </div>

      <Button
        variant="danger"
        fullWidth
        onClick={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
      >
        {loggingOut ? 'Logging out...' : 'Log Out'}
      </Button>
    </div>
  );
}

