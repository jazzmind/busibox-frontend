'use client';

import { PlayCircle, Shield, Zap, FileCheck } from 'lucide-react';
import Link from 'next/link';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

export function QuickActions() {
  const actions: QuickAction[] = [
    {
      id: 'run-all-unit',
      title: 'Run All Unit Tests',
      description: 'Execute all unit tests across all projects',
      icon: <Zap className="w-6 h-6" />,
      href: '/tests/runner?type=unit',
      color: 'bg-blue-500',
    },
    {
      id: 'run-all-integration',
      title: 'Run All Integration Tests',
      description: 'Execute all integration tests across all services',
      icon: <PlayCircle className="w-6 h-6" />,
      href: '/tests/runner?type=integration',
      color: 'bg-purple-500',
    },
    {
      id: 'run-pvt',
      title: 'Run PVT Tests',
      description: 'Production Verification Tests for all services',
      icon: <FileCheck className="w-6 h-6" />,
      href: '/tests/runner?type=pvt',
      color: 'bg-emerald-500',
    },
    {
      id: 'run-security',
      title: 'Run Security Tests',
      description: 'Execute comprehensive security test suite',
      icon: <Shield className="w-6 h-6" />,
      href: '/tests/runner?type=security',
      color: 'bg-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition group"
        >
          <div className="flex items-start gap-4">
            <div className={`${action.color} text-white p-3 rounded-lg group-hover:scale-110 transition`}>
              {action.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{action.title}</h3>
              <p className="text-sm text-gray-600">{action.description}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
