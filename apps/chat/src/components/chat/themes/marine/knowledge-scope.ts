export type KnowledgeScope = 'all' | 'libraries' | 'attachments';

export interface KnowledgeAuthority {
  scope: KnowledgeScope;
  selectedLibraryId?: string;
}

export function readKnowledgeAuthority(messages: unknown[]): KnowledgeAuthority {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as any;
    if (message?.role !== 'assistant') continue;
    const routing = message.routingDecision || message.routing_decision;
    const scope = routing?.knowledge_scope;
    if (scope === 'attachments') return { scope };
    if (scope === 'libraries') {
      const libraryId = routing?.selected_library_ids?.[0];
      if (typeof libraryId === 'string' && libraryId) {
        return { scope, selectedLibraryId: libraryId };
      }
      return { scope: 'all' };
    }
    if (scope === 'all') return { scope };
  }
  return { scope: 'all' };
}

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
