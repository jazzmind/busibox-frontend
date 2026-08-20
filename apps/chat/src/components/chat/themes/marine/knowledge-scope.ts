export type KnowledgeScope = 'all' | 'libraries' | 'attachments';

export function buildKnowledgeScopeRequest(
  scope: KnowledgeScope,
  selectedLibraryId?: string,
): {
  knowledge_scope: KnowledgeScope;
  selected_library_ids?: string[];
} {
  return {
    knowledge_scope: scope,
    selected_library_ids:
      scope === 'libraries' && selectedLibraryId ? [selectedLibraryId] : undefined,
  };
}
