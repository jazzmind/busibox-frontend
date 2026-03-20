/**
 * @jazzmind/busibox-app - Main Entry Point
 * 
 * This is the root export for backward compatibility.
 * For better tree-shaking and smaller bundles, prefer importing from subpaths:
 * 
 * @example
 * // Instead of:
 * import { Button, agentChat, getMilvusClient } from '@jazzmind/busibox-app';
 * 
 * // Use:
 * import { Button } from '@jazzmind/busibox-app/components';
 * import { agentChat } from '@jazzmind/busibox-app/lib/agent';
 * import { getMilvusClient } from '@jazzmind/busibox-app/lib/milvus';
 */

// Re-export everything from subdirectories for backward compatibility
export * from './components';
export * from './contexts';
export * from './layout';

// Types - export from index and individual type files
export * from './types';
export type { ChatMessage, ChatModelOption, MessagePart } from './types/chat';
export type { DocumentWithUser, TagGroup, TocItem, DocumentChunk, ProcessingHistoryGroup, ProcessingHistoryStep } from './types/documents';
export type { LibrarySidebarItem, RoleSummary, AppDataLibraryItem, AppDataGroup, AppDataSchema, AppDataFieldDef, AppDataRelationType, AppDataRelation } from './types/library';
export type { DataProcessingHistoryEntry, DataProcessingHistoryResponse } from './types/processing-history';
export type {
  Video,
  VideoWithOwner,
  VideoWithShares,
  VideoShareWithUser,
  ReferenceMediaInfo,
  ReferenceMediaUpload,
  FileValidationResult,
  VideoExpirationStatus,
  AllowedDuration,
  AllowedResolution,
} from './types/video';
export { VideoStatus, VideoVisibility, ReferenceMediaType, ReferenceMediaFormat } from './types/video';
export * from './lib';
