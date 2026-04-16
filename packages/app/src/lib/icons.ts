/**
 * Icon Library
 *
 * Uses lucide-react icons. Icon names are PascalCase lucide icon names
 * (e.g., "Video", "MessageCircle", "BarChart3").
 *
 * A curated subset is exposed for the icon picker with categories.
 * All 1600+ lucide icons can be used by name even if not in the curated list.
 *
 * Legacy icon names (lowercase, from the original custom SVG set) are
 * mapped to their lucide equivalents for backward compatibility.
 */

import { icons as lucideIcons } from 'lucide-react';

export type IconCategory =
  | 'general'
  | 'media'
  | 'productivity'
  | 'tech'
  | 'business'
  | 'communication'
  | 'finance'
  | 'science'
  | 'health'
  | 'creative'
  | 'files'
  | 'transport'
  | 'nature'
  | 'social'
  | 'ai'
  | 'status';

export type IconName = string;

export interface Icon {
  name: IconName;
  label: string;
  category: IconCategory;
}

/**
 * Maps legacy custom SVG icon names to their lucide equivalents.
 */
const LEGACY_ICON_MAP: Record<string, string> = {
  video: 'Video',
  library: 'Library',
  chat: 'MessageCircle',
  code: 'Code',
  database: 'Database',
  analytics: 'BarChart3',
  settings: 'Settings',
  users: 'Users',
  calendar: 'Calendar',
  email: 'Mail',
  documents: 'FileText',
  images: 'Image',
  music: 'Music',
  search: 'Search',
  security: 'Lock',
  cloud: 'Cloud',
  mobile: 'Smartphone',
  desktop: 'Monitor',
  globe: 'Globe',
  rocket: 'Rocket',
  star: 'Star',
  heart: 'Heart',
  shield: 'ShieldCheck',
  bell: 'Bell',
  briefcase: 'Briefcase',
  chart: 'BarChart',
  clipboard: 'ClipboardList',
  command: 'Terminal',
  cpu: 'Cpu',
  grid: 'LayoutGrid',
};

/**
 * Resolves a potentially-legacy icon name to a lucide PascalCase name.
 */
export function resolveLucideIconName(name: string): string {
  return LEGACY_ICON_MAP[name] || name;
}

/**
 * Check if a lucide icon exists by name.
 */
export function isValidIcon(name: string): boolean {
  const resolved = resolveLucideIconName(name);
  return resolved in lucideIcons;
}

/**
 * Get the lucide icon component by name. Returns undefined if not found.
 */
export function getLucideIcon(name: string) {
  const resolved = resolveLucideIconName(name);
  return (lucideIcons as Record<string, any>)[resolved] ?? undefined;
}

// ---------------------------------------------------------------------------
// Curated icon list for the picker (organized by category)
// ---------------------------------------------------------------------------

export const CURATED_ICONS: Icon[] = [
  // AI & Machine Learning
  { name: 'Brain', label: 'Brain', category: 'ai' },
  { name: 'BrainCircuit', label: 'Brain Circuit', category: 'ai' },
  { name: 'BrainCog', label: 'Brain Cog', category: 'ai' },
  { name: 'Bot', label: 'Bot', category: 'ai' },
  { name: 'BotMessageSquare', label: 'Bot Chat', category: 'ai' },
  { name: 'Sparkles', label: 'Sparkles', category: 'ai' },
  { name: 'Wand2', label: 'Magic Wand', category: 'ai' },
  { name: 'Cpu', label: 'CPU', category: 'ai' },
  { name: 'CircuitBoard', label: 'Circuit Board', category: 'ai' },
  { name: 'Workflow', label: 'Workflow', category: 'ai' },
  { name: 'Network', label: 'Network', category: 'ai' },
  { name: 'Orbit', label: 'Orbit', category: 'ai' },
  { name: 'Atom', label: 'Atom', category: 'ai' },
  { name: 'Lightbulb', label: 'Lightbulb', category: 'ai' },

  // General
  { name: 'Home', label: 'Home', category: 'general' },
  { name: 'Search', label: 'Search', category: 'general' },
  { name: 'Settings', label: 'Settings', category: 'general' },
  { name: 'Bell', label: 'Bell', category: 'general' },
  { name: 'Globe', label: 'Globe', category: 'general' },
  { name: 'LayoutGrid', label: 'Grid', category: 'general' },
  { name: 'LayoutDashboard', label: 'Dashboard', category: 'general' },
  { name: 'Bookmark', label: 'Bookmark', category: 'general' },
  { name: 'Tag', label: 'Tag', category: 'general' },
  { name: 'Tags', label: 'Tags', category: 'general' },
  { name: 'Star', label: 'Star', category: 'general' },
  { name: 'Heart', label: 'Heart', category: 'general' },
  { name: 'ThumbsUp', label: 'Thumbs Up', category: 'general' },
  { name: 'Pin', label: 'Pin', category: 'general' },
  { name: 'Flag', label: 'Flag', category: 'general' },
  { name: 'Award', label: 'Award', category: 'general' },
  { name: 'Trophy', label: 'Trophy', category: 'general' },
  { name: 'Zap', label: 'Zap', category: 'general' },
  { name: 'Rocket', label: 'Rocket', category: 'general' },
  { name: 'Eye', label: 'Eye', category: 'general' },
  { name: 'Clock', label: 'Clock', category: 'general' },
  { name: 'Timer', label: 'Timer', category: 'general' },
  { name: 'MapPin', label: 'Map Pin', category: 'general' },
  { name: 'Map', label: 'Map', category: 'general' },
  { name: 'Navigation', label: 'Navigation', category: 'general' },
  { name: 'Compass', label: 'Compass', category: 'general' },
  { name: 'Link', label: 'Link', category: 'general' },
  { name: 'ExternalLink', label: 'External Link', category: 'general' },
  { name: 'QrCode', label: 'QR Code', category: 'general' },
  { name: 'ScanLine', label: 'Scan', category: 'general' },
  { name: 'Smartphone', label: 'Smartphone', category: 'general' },
  { name: 'Monitor', label: 'Monitor', category: 'general' },
  { name: 'Laptop', label: 'Laptop', category: 'general' },
  { name: 'Tablet', label: 'Tablet', category: 'general' },
  { name: 'Watch', label: 'Watch', category: 'general' },
  { name: 'Plug', label: 'Plug', category: 'general' },
  { name: 'Power', label: 'Power', category: 'general' },
  { name: 'Battery', label: 'Battery', category: 'general' },
  { name: 'Wifi', label: 'WiFi', category: 'general' },
  { name: 'Bluetooth', label: 'Bluetooth', category: 'general' },

  // Media
  { name: 'Video', label: 'Video', category: 'media' },
  { name: 'Camera', label: 'Camera', category: 'media' },
  { name: 'Image', label: 'Image', category: 'media' },
  { name: 'Images', label: 'Images', category: 'media' },
  { name: 'Film', label: 'Film', category: 'media' },
  { name: 'Music', label: 'Music', category: 'media' },
  { name: 'Music2', label: 'Music 2', category: 'media' },
  { name: 'Headphones', label: 'Headphones', category: 'media' },
  { name: 'Mic', label: 'Microphone', category: 'media' },
  { name: 'Volume2', label: 'Volume', category: 'media' },
  { name: 'Radio', label: 'Radio', category: 'media' },
  { name: 'Tv', label: 'TV', category: 'media' },
  { name: 'Play', label: 'Play', category: 'media' },
  { name: 'Youtube', label: 'YouTube', category: 'media' },
  { name: 'Podcast', label: 'Podcast', category: 'media' },
  { name: 'Clapperboard', label: 'Clapperboard', category: 'media' },
  { name: 'Aperture', label: 'Aperture', category: 'media' },
  { name: 'Focus', label: 'Focus', category: 'media' },

  // Productivity
  { name: 'Library', label: 'Library', category: 'productivity' },
  { name: 'FileText', label: 'Document', category: 'productivity' },
  { name: 'Files', label: 'Files', category: 'productivity' },
  { name: 'FolderOpen', label: 'Folder Open', category: 'productivity' },
  { name: 'Folder', label: 'Folder', category: 'productivity' },
  { name: 'Calendar', label: 'Calendar', category: 'productivity' },
  { name: 'CalendarDays', label: 'Calendar Days', category: 'productivity' },
  { name: 'ClipboardList', label: 'Clipboard List', category: 'productivity' },
  { name: 'ClipboardCheck', label: 'Clipboard Check', category: 'productivity' },
  { name: 'ListChecks', label: 'Checklist', category: 'productivity' },
  { name: 'ListTodo', label: 'Todo List', category: 'productivity' },
  { name: 'CheckSquare', label: 'Check Square', category: 'productivity' },
  { name: 'StickyNote', label: 'Sticky Note', category: 'productivity' },
  { name: 'NotebookPen', label: 'Notebook', category: 'productivity' },
  { name: 'PenTool', label: 'Pen Tool', category: 'productivity' },
  { name: 'Pencil', label: 'Pencil', category: 'productivity' },
  { name: 'Eraser', label: 'Eraser', category: 'productivity' },
  { name: 'Printer', label: 'Printer', category: 'productivity' },
  { name: 'Archive', label: 'Archive', category: 'productivity' },
  { name: 'Inbox', label: 'Inbox', category: 'productivity' },
  { name: 'Package', label: 'Package', category: 'productivity' },
  { name: 'Kanban', label: 'Kanban', category: 'productivity' },
  { name: 'GanttChart', label: 'Gantt Chart', category: 'productivity' },
  { name: 'Table', label: 'Table', category: 'productivity' },
  { name: 'Sheet', label: 'Spreadsheet', category: 'productivity' },
  { name: 'Presentation', label: 'Presentation', category: 'productivity' },
  { name: 'BookOpen', label: 'Book Open', category: 'productivity' },
  { name: 'BookMarked', label: 'Bookmarked', category: 'productivity' },
  { name: 'GraduationCap', label: 'Education', category: 'productivity' },

  // Tech
  { name: 'Code', label: 'Code', category: 'tech' },
  { name: 'Code2', label: 'Code 2', category: 'tech' },
  { name: 'Terminal', label: 'Terminal', category: 'tech' },
  { name: 'Database', label: 'Database', category: 'tech' },
  { name: 'Server', label: 'Server', category: 'tech' },
  { name: 'Cloud', label: 'Cloud', category: 'tech' },
  { name: 'CloudCog', label: 'Cloud Cog', category: 'tech' },
  { name: 'Container', label: 'Container', category: 'tech' },
  { name: 'HardDrive', label: 'Hard Drive', category: 'tech' },
  { name: 'Bug', label: 'Bug', category: 'tech' },
  { name: 'GitBranch', label: 'Git Branch', category: 'tech' },
  { name: 'GitPullRequest', label: 'Pull Request', category: 'tech' },
  { name: 'Github', label: 'GitHub', category: 'tech' },
  { name: 'Globe', label: 'Web', category: 'tech' },
  { name: 'Blocks', label: 'Blocks', category: 'tech' },
  { name: 'Puzzle', label: 'Puzzle', category: 'tech' },
  { name: 'Layers', label: 'Layers', category: 'tech' },
  { name: 'Box', label: 'Box', category: 'tech' },
  { name: 'Boxes', label: 'Boxes', category: 'tech' },
  { name: 'Webhook', label: 'Webhook', category: 'tech' },
  { name: 'Cog', label: 'Cog', category: 'tech' },
  { name: 'Wrench', label: 'Wrench', category: 'tech' },
  { name: 'Hammer', label: 'Hammer', category: 'tech' },
  { name: 'Construction', label: 'Construction', category: 'tech' },
  { name: 'Cable', label: 'Cable', category: 'tech' },
  { name: 'Radio', label: 'Radio', category: 'tech' },
  { name: 'Radar', label: 'Radar', category: 'tech' },
  { name: 'Satellite', label: 'Satellite', category: 'tech' },
  { name: 'SatelliteDish', label: 'Satellite Dish', category: 'tech' },

  // Business
  { name: 'Briefcase', label: 'Briefcase', category: 'business' },
  { name: 'Building', label: 'Building', category: 'business' },
  { name: 'Building2', label: 'Office', category: 'business' },
  { name: 'Store', label: 'Store', category: 'business' },
  { name: 'ShoppingCart', label: 'Shopping Cart', category: 'business' },
  { name: 'ShoppingBag', label: 'Shopping Bag', category: 'business' },
  { name: 'CreditCard', label: 'Credit Card', category: 'business' },
  { name: 'Receipt', label: 'Receipt', category: 'business' },
  { name: 'Handshake', label: 'Handshake', category: 'business' },
  { name: 'Target', label: 'Target', category: 'business' },
  { name: 'TrendingUp', label: 'Trending Up', category: 'business' },
  { name: 'TrendingDown', label: 'Trending Down', category: 'business' },
  { name: 'BarChart', label: 'Bar Chart', category: 'business' },
  { name: 'BarChart3', label: 'Analytics', category: 'business' },
  { name: 'PieChart', label: 'Pie Chart', category: 'business' },
  { name: 'LineChart', label: 'Line Chart', category: 'business' },
  { name: 'AreaChart', label: 'Area Chart', category: 'business' },
  { name: 'Activity', label: 'Activity', category: 'business' },
  { name: 'Gauge', label: 'Gauge', category: 'business' },
  { name: 'Scale', label: 'Scale', category: 'business' },
  { name: 'Landmark', label: 'Landmark', category: 'business' },
  { name: 'Megaphone', label: 'Megaphone', category: 'business' },
  { name: 'BadgeDollarSign', label: 'Badge Dollar', category: 'business' },
  { name: 'Banknote', label: 'Banknote', category: 'business' },
  { name: 'Coins', label: 'Coins', category: 'business' },

  // Communication
  { name: 'MessageCircle', label: 'Chat', category: 'communication' },
  { name: 'MessageSquare', label: 'Message', category: 'communication' },
  { name: 'MessagesSquare', label: 'Messages', category: 'communication' },
  { name: 'Mail', label: 'Email', category: 'communication' },
  { name: 'MailOpen', label: 'Mail Open', category: 'communication' },
  { name: 'Send', label: 'Send', category: 'communication' },
  { name: 'Phone', label: 'Phone', category: 'communication' },
  { name: 'PhoneCall', label: 'Phone Call', category: 'communication' },
  { name: 'AtSign', label: 'At Sign', category: 'communication' },
  { name: 'Hash', label: 'Hash', category: 'communication' },
  { name: 'Share2', label: 'Share', category: 'communication' },
  { name: 'Forward', label: 'Forward', category: 'communication' },
  { name: 'Reply', label: 'Reply', category: 'communication' },
  { name: 'Rss', label: 'RSS', category: 'communication' },

  // Finance
  { name: 'DollarSign', label: 'Dollar', category: 'finance' },
  { name: 'Euro', label: 'Euro', category: 'finance' },
  { name: 'PoundSterling', label: 'Pound', category: 'finance' },
  { name: 'Wallet', label: 'Wallet', category: 'finance' },
  { name: 'Landmark', label: 'Bank', category: 'finance' },
  { name: 'Calculator', label: 'Calculator', category: 'finance' },
  { name: 'Percent', label: 'Percent', category: 'finance' },
  { name: 'ArrowUpDown', label: 'Exchange', category: 'finance' },
  { name: 'Receipt', label: 'Invoice', category: 'finance' },

  // Creative
  { name: 'Palette', label: 'Palette', category: 'creative' },
  { name: 'Paintbrush', label: 'Paintbrush', category: 'creative' },
  { name: 'PaintBucket', label: 'Paint Bucket', category: 'creative' },
  { name: 'Brush', label: 'Brush', category: 'creative' },
  { name: 'Scissors', label: 'Scissors', category: 'creative' },
  { name: 'Ruler', label: 'Ruler', category: 'creative' },
  { name: 'Figma', label: 'Design', category: 'creative' },
  { name: 'Pipette', label: 'Color Picker', category: 'creative' },
  { name: 'Shapes', label: 'Shapes', category: 'creative' },
  { name: 'PenLine', label: 'Pen', category: 'creative' },
  { name: 'Type', label: 'Typography', category: 'creative' },
  { name: 'Sparkle', label: 'Sparkle', category: 'creative' },

  // Files & Storage
  { name: 'File', label: 'File', category: 'files' },
  { name: 'FileText', label: 'Text File', category: 'files' },
  { name: 'FileImage', label: 'Image File', category: 'files' },
  { name: 'FileVideo', label: 'Video File', category: 'files' },
  { name: 'FileAudio', label: 'Audio File', category: 'files' },
  { name: 'FileCode', label: 'Code File', category: 'files' },
  { name: 'FileSpreadsheet', label: 'Spreadsheet', category: 'files' },
  { name: 'FileArchive', label: 'Archive', category: 'files' },
  { name: 'Download', label: 'Download', category: 'files' },
  { name: 'Upload', label: 'Upload', category: 'files' },
  { name: 'FolderTree', label: 'Folder Tree', category: 'files' },
  { name: 'FolderGit', label: 'Repo', category: 'files' },
  { name: 'HardDrive', label: 'Storage', category: 'files' },
  { name: 'DatabaseZap', label: 'Database Zap', category: 'files' },

  // People & Social
  { name: 'User', label: 'User', category: 'social' },
  { name: 'Users', label: 'Users', category: 'social' },
  { name: 'UserPlus', label: 'Add User', category: 'social' },
  { name: 'UserCog', label: 'User Settings', category: 'social' },
  { name: 'Contact', label: 'Contact', category: 'social' },
  { name: 'PersonStanding', label: 'Person', category: 'social' },
  { name: 'Group', label: 'Group', category: 'social' },
  { name: 'Crown', label: 'Crown', category: 'social' },
  { name: 'BadgeCheck', label: 'Verified', category: 'social' },

  // Science & Education
  { name: 'Microscope', label: 'Microscope', category: 'science' },
  { name: 'FlaskConical', label: 'Flask', category: 'science' },
  { name: 'TestTube2', label: 'Test Tube', category: 'science' },
  { name: 'Dna', label: 'DNA', category: 'science' },
  { name: 'Beaker', label: 'Beaker', category: 'science' },
  { name: 'Calculator', label: 'Calculator', category: 'science' },
  { name: 'Telescope', label: 'Telescope', category: 'science' },

  // Health
  { name: 'HeartPulse', label: 'Heart Pulse', category: 'health' },
  { name: 'Stethoscope', label: 'Stethoscope', category: 'health' },
  { name: 'Pill', label: 'Pill', category: 'health' },
  { name: 'Syringe', label: 'Syringe', category: 'health' },
  { name: 'Cross', label: 'Medical', category: 'health' },
  { name: 'Thermometer', label: 'Thermometer', category: 'health' },
  { name: 'Baby', label: 'Baby', category: 'health' },
  { name: 'Accessibility', label: 'Accessibility', category: 'health' },

  // Transport
  { name: 'Car', label: 'Car', category: 'transport' },
  { name: 'Truck', label: 'Truck', category: 'transport' },
  { name: 'Ship', label: 'Ship', category: 'transport' },
  { name: 'Plane', label: 'Plane', category: 'transport' },
  { name: 'Train', label: 'Train', category: 'transport' },
  { name: 'Bike', label: 'Bike', category: 'transport' },
  { name: 'Anchor', label: 'Anchor', category: 'transport' },
  { name: 'Navigation', label: 'Navigation', category: 'transport' },
  { name: 'Compass', label: 'Compass', category: 'transport' },
  { name: 'Milestone', label: 'Milestone', category: 'transport' },

  // Nature
  { name: 'Leaf', label: 'Leaf', category: 'nature' },
  { name: 'Trees', label: 'Trees', category: 'nature' },
  { name: 'Flower2', label: 'Flower', category: 'nature' },
  { name: 'Sun', label: 'Sun', category: 'nature' },
  { name: 'Moon', label: 'Moon', category: 'nature' },
  { name: 'CloudSun', label: 'Weather', category: 'nature' },
  { name: 'Snowflake', label: 'Snowflake', category: 'nature' },
  { name: 'Droplets', label: 'Water', category: 'nature' },
  { name: 'Mountain', label: 'Mountain', category: 'nature' },
  { name: 'Waves', label: 'Waves', category: 'nature' },
  { name: 'Wind', label: 'Wind', category: 'nature' },
  { name: 'Flame', label: 'Flame', category: 'nature' },

  // Security / Status
  { name: 'Lock', label: 'Lock', category: 'status' },
  { name: 'Unlock', label: 'Unlock', category: 'status' },
  { name: 'ShieldCheck', label: 'Shield Check', category: 'status' },
  { name: 'Shield', label: 'Shield', category: 'status' },
  { name: 'ShieldAlert', label: 'Shield Alert', category: 'status' },
  { name: 'Key', label: 'Key', category: 'status' },
  { name: 'KeyRound', label: 'Key Round', category: 'status' },
  { name: 'Fingerprint', label: 'Fingerprint', category: 'status' },
  { name: 'ScanFace', label: 'Face ID', category: 'status' },
  { name: 'AlertTriangle', label: 'Warning', category: 'status' },
  { name: 'AlertCircle', label: 'Alert', category: 'status' },
  { name: 'CheckCircle', label: 'Success', category: 'status' },
  { name: 'XCircle', label: 'Error', category: 'status' },
  { name: 'Info', label: 'Info', category: 'status' },
  { name: 'HelpCircle', label: 'Help', category: 'status' },
];

/**
 * All available lucide icon names (for search in the icon picker).
 */
export function getAllLucideIconNames(): string[] {
  return Object.keys(lucideIcons);
}

/**
 * Get the curated icon list for the picker.
 */
export function getCuratedIcons(): Icon[] {
  return CURATED_ICONS;
}

/**
 * Get curated icons filtered by category.
 */
export function getIconsByCategory(category: IconCategory): Icon[] {
  return CURATED_ICONS.filter((icon) => icon.category === category);
}

/**
 * Get all categories that have curated icons.
 */
export function getCategories(): IconCategory[] {
  const cats = new Set(CURATED_ICONS.map((i) => i.category));
  return Array.from(cats);
}

// ---------------------------------------------------------------------------
// Backward-compatible exports
// ---------------------------------------------------------------------------

/**
 * @deprecated Use CURATED_ICONS instead.
 */
export const ICONS = CURATED_ICONS;

/**
 * @deprecated Use getLucideIcon() instead.
 * Returns a compat object with name/label/category/svg for legacy consumers.
 */
export function getIcon(name: string): (Icon & { svg: string }) | undefined {
  const resolved = resolveLucideIconName(name);
  const icon = CURATED_ICONS.find((i) => i.name === resolved);
  if (!icon) return undefined;

  const LucideComponent = getLucideIcon(resolved);
  if (!LucideComponent) return undefined;

  // For legacy consumers that need SVG strings, we won't generate them.
  // Return a placeholder so existing code doesn't break, but AppIcon should
  // be used for rendering.
  return {
    ...icon,
    svg: '',
  };
}
