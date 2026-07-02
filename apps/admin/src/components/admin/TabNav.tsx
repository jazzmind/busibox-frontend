/**
 * Shared tab-bar primitives for admin pages with a primary tab row and, for
 * some tabs, a secondary sub-nav row underneath (e.g. /settings, /ai, /data).
 */

'use client';

import { useCustomization } from '@jazzmind/busibox-app';

export type TabDef<T extends string> = { id: T; icon: React.ElementType; label: string };

/** Primary tab bar — larger icons, bottom border on the page's white background. */
export function TabNav<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabDef<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  const { customization } = useCustomization();
  const tabStyle = (id: T) =>
    active === id ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex gap-8 overflow-x-auto" aria-label="Primary tabs">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                active === id
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
  );
}

/** Secondary sub-nav bar — smaller icons, gray background, used underneath a primary tab. */
export function SubNav<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabDef<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  const { customization } = useCustomization();
  const subStyle = (id: T) =>
    active === id ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined;

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
              style={subStyle(id)}
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

/** Tinted info banner used to introduce a tab/sub-tab's purpose. */
export function SectionBanner({ title, desc }: { title: string; desc: string | React.ReactNode }) {
  const { customization } = useCustomization();
  return (
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
}
