/**
 * PublicFooter Component
 * 
 * Minimal footer for public pages.
 */

import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          {/* Brand */}
          <div>
            <Link href="/about" className="flex items-center gap-2 font-semibold text-gray-900">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" />
                <path d="M9 9h6M9 12h6M9 15h4" stroke="rgb(249 115 22)" />
              </svg>
              Busibox
            </Link>
            <p className="mt-2 text-sm text-gray-500 max-w-xs">
              Secure AI infrastructure for organizations that need control over their data.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Documentation</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/docs/user" className="text-sm text-gray-500 hover:text-gray-900">
                    User Guide
                  </Link>
                </li>
                <li>
                  <Link href="/docs/developer" className="text-sm text-gray-500 hover:text-gray-900">
                    Developer
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Product</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/about" className="text-sm text-gray-500 hover:text-gray-900">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                    Login
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Busibox
          </p>
        </div>
      </div>
    </footer>
  );
}
