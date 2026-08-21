import { describe, expect, it } from 'vitest';
import { buildKnowledgeScopeRequest, readKnowledgeAuthority } from '../knowledge-scope';

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

describe('readKnowledgeAuthority', () => {
  it('restores the selected library from the latest assistant message', () => {
    expect(
      readKnowledgeAuthority([
        {
          role: 'assistant',
          routingDecision: {
            knowledge_scope: 'libraries',
            selected_library_ids: ['cashman-docs'],
          },
        },
      ]),
    ).toEqual({ scope: 'libraries', selectedLibraryId: 'cashman-docs' });
  });

  it('restores attachment-only authority after reopening a conversation', () => {
    expect(
      readKnowledgeAuthority([
        { role: 'assistant', routing_decision: { knowledge_scope: 'attachments' } },
      ]),
    ).toEqual({ scope: 'attachments' });
  });

  it('uses the latest saved authority and safely falls back to all', () => {
    expect(
      readKnowledgeAuthority([
        { role: 'assistant', routingDecision: { knowledge_scope: 'attachments' } },
        { role: 'assistant', routingDecision: { knowledge_scope: 'all' } },
      ]),
    ).toEqual({ scope: 'all' });

    expect(
      readKnowledgeAuthority([
        { role: 'assistant', routingDecision: { knowledge_scope: 'libraries' } },
      ]),
    ).toEqual({ scope: 'all' });
  });
});
