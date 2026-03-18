/**
 * Data service client exports
 */

export {
  dataFetch,
  uploadChatAttachment,
  parseFileToMarkdown,
  dataChatAttachment,
  getChatAttachmentUrl,
  deleteChatAttachment,
  getDataServiceUrl,
} from './client';

export type {
  DataServiceError,
  DataClientOptions,
} from './client';

export {
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingsConfigured,
  getEmbeddingDimension,
} from './embeddings';

export type {
  EmbeddingsClientOptions,
} from './embeddings';

// Session-aware embeddings helpers
export {
  setEmbeddingSessionJwt,
  clearEmbeddingSessionJwt,
  generateEmbeddingForUser,
  generateEmbeddingsForUser,
} from './embeddings-session';

// Data documents (generic CRUD for data-api)
export {
  generateId,
  getNow,
  cleanRecord,
  extractRoleIdsFromToken,
  listDataDocuments,
  createDataDocument,
  getDocumentByName,
  getDocumentDetails,
  updateDocumentMetadata,
  getDocumentRoles,
  updateDocumentRoles,
  ensureSchemaAndMetadata,
  queryRecords,
  insertRecords,
  updateRecords,
  deleteRecords,
  ensureDocuments,
} from './documents';

export type {
  DocumentInfo,
  DataDocument,
  QueryOptions,
  QueryFilter,
  QueryCondition,
  DataDocumentsOptions,
  DocumentRoleAssignment,
  DocumentRolesResponse,
} from './documents';

// Document sharing (team roles, visibility, member management)
export {
  ensureTeamRole,
  ensureRoleAppBinding,
  verifyRoleExists,
  addRoleToDocuments,
  removeRoleFromDocuments,
  addRoleToLibrary,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  searchUsers,
  resolveVisibilityMode,
  normalizeVisibilityMode,
  setDocumentVisibility,
  getSSOTokenFromRequest,
} from './sharing';

export type {
  VisibilityMode,
  TeamMember,
  TeamRole,
  SearchUser,
} from './sharing';

