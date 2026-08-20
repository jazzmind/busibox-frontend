import { describe, expect, it } from 'vitest';
import { buildKnowledgeScopeRequest } from '../knowledge-scope';

describe('buildKnowledgeScopeRequest', () => {
  it('uses all accessible documents without a library filter', () => {
    expect(buildKnowledgeScopeRequest('all', 'ignored-library')).toEqual({
      knowledge_scope: 'all',
      selected_library_ids: undefined,
    });
  });

  it('uses the selected library only in library mode', () => {
    expect(buildKnowledgeScopeRequest('libraries', 'library-1')).toEqual({
      knowledge_scope: 'libraries',
      selected_library_ids: ['library-1'],
    });
  });

  it('does not leak a library filter into attachments-only mode', () => {
    expect(buildKnowledgeScopeRequest('attachments', 'ignored-library')).toEqual({
      knowledge_scope: 'attachments',
      selected_library_ids: undefined,
    });
  });
});
