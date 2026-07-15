/**
 * Marine theme — barrel export.
 *
 * Consumers of the theme only need this file:
 *   import { MarineChatPage } from '@/components/chat/themes/marine';
 */

export { MarineChatPage } from './ChatPage';
export { MarineChatShell } from './ChatShell';
export { MarineHeader } from './Header';
export { MarineSidebar } from './Sidebar';
export { MarineEmptyState } from './EmptyState';
export { MarineMessages } from './Messages';
export { MarineComposer } from './Composer';
export { MarineSourcePanel } from './SourcePanel';
export { MarineDebugPanel } from './DebugPanel';
export { MarineDebugToggle, useDebugMode } from './DebugToggle';
export { marineBrand } from './config';
export type { MarineBrandConfig, SuggestedPrompt } from './config';
export { Tooltip } from './primitives/Tooltip';
export { CitationPreview } from './primitives/CitationPreview';
export type { CitationPreviewData } from './primitives/CitationPreview';
