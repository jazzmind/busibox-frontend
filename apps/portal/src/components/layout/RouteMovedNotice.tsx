'use client';

import Link from 'next/link';

interface RouteMovedNoticeProps {
  title: string;
  description: string;
  targetPath: string;
  targetLabel: string;
}

export function RouteMovedNotice({
  title,
  description,
  targetPath,
  targetLabel,
}: RouteMovedNoticeProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-3 text-gray-600">{description}</p>
        <Link
          href={targetPath}
          className="inline-flex mt-6 items-center rounded-lg bg-[#1a4d4d] px-4 py-2 text-white hover:bg-[#2d6666] transition-colors"
        >
          Open {targetLabel}
        </Link>
      </div>
    </div>
  );
}
