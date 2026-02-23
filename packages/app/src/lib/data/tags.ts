/**
 * Tag utilities for document libraries.
 *
 * Tag data comes from data-api document metadata (extractedKeywords).
 * getLibraryTagGroups aggregates extractedKeywords from library documents
 * and returns tag groups for the Tags tab.
 */

import { agentApiFetch } from '../agent/agent-api-base';
import { getAuthzToken } from '../agent/app-client';
import { getLibraryDocuments } from './libraries';

export interface TagGroup {
  name: string;
  tags: string[];
  confidence?: number;
  documentCount?: number;
}

/**
 * Classify tags into semantic groups using Agent API
 */
export async function classifyTags(
  tags: string[],
  options: { maxGroups?: number; context?: string; userId?: string } = {}
): Promise<TagGroup[]> {
  if (tags.length === 0) {
    return [];
  }

  try {
    let token: string | undefined;
    if (options.userId) {
      try {
        token = await getAuthzToken(options.userId, 'agent-api', []);
      } catch {
        // Auth optional for classify-tags
      }
    }

    const response = await agentApiFetch('/classify-tags', {
      method: 'POST',
      token,
      body: JSON.stringify({
        tags,
        maxGroups: options.maxGroups || 10,
        context: options.context,
      }),
    });

    const data = await response.json();
    return data.groups || [];
  } catch (error: unknown) {
    // 404 is expected when Agent API doesn't have classify-tags (optional feature)
    const is404 = error instanceof Error && error.message.includes('404');
    if (!is404) {
      console.error('[TAGS] Classification error:', error);
    }
    return fallbackGrouping(tags);
  }
}

/**
 * Get tag groups for a library from extractedKeywords.
 *
 * Uses classifyTags (Agent API) to group related tags semantically when possible.
 * Falls back to one-tag-per-group if classification fails or returns empty.
 * Each group includes documentCount (docs containing any tag in the group).
 */
export async function getLibraryTagGroups(
  libraryId: string,
  _refresh: boolean,
  options: { sessionJwt: string; userId: string }
): Promise<TagGroup[]> {
  const { sessionJwt, userId } = options;
  if (!sessionJwt || !userId) {
    return [];
  }

  try {
    const documents = await getLibraryDocuments(libraryId, {
      sortBy: 'createdAt',
      sortOrder: 'desc',
      sessionJwt,
      userId,
    });

    const keywordToDocCount = new Map<string, number>();
    const docKeywords = new Map<string, Set<string>>(); // docId -> Set of keywords
    for (const doc of documents) {
      const docId = String(doc.id ?? '');
      const keywords = doc.extractedKeywords ?? doc.extracted_keywords ?? [];
      const kwList = Array.isArray(keywords) ? keywords : [];
      const seen = new Set<string>();
      const docKws = new Set<string>();
      for (const kw of kwList) {
        const k = String(kw).trim();
        if (k && !seen.has(k)) {
          seen.add(k);
          docKws.add(k);
          keywordToDocCount.set(k, (keywordToDocCount.get(k) ?? 0) + 1);
        }
      }
      docKeywords.set(docId, docKws);
    }

    const allKeywords = Array.from(keywordToDocCount.keys());
    if (allKeywords.length === 0) return [];

    // Try semantic grouping via Agent API (groups related tags together)
    // Fall back to heuristic grouping (prefix/root) when Agent classify-tags is unavailable
    let tagGroups: TagGroup[];
    try {
      const classified = await classifyTags(allKeywords, {
        maxGroups: Math.min(15, Math.max(5, Math.ceil(allKeywords.length / 3))),
        context: 'library document keywords',
        userId,
      });
      if (classified.length > 0) {
        tagGroups = classified;
      } else {
        tagGroups = heuristicTagGrouping(allKeywords);
      }
    } catch {
      tagGroups = heuristicTagGrouping(allKeywords);
    }

    // Compute documentCount for each group: docs that have ANY tag in the group
    const tagSet = new Set(allKeywords);
    for (const group of tagGroups) {
      const groupTags = group.tags.filter(t => tagSet.has(t));
      if (groupTags.length === 0) {
        group.documentCount = 0;
        continue;
      }
      let count = 0;
      for (const docKws of docKeywords.values()) {
        if (groupTags.some(t => docKws.has(t))) count++;
      }
      group.documentCount = count;
    }

    return tagGroups
      .filter(g => (g.documentCount ?? 0) > 0)
      .sort((a, b) => (b.documentCount ?? 0) - (a.documentCount ?? 0));
  } catch (error) {
    console.error('[TAGS] getLibraryTagGroups error:', error);
    return [];
  }
}

function fallbackGrouping(tags: string[]): TagGroup[] {
  return tags
    .map((tag) => ({
      name: tag,
      tags: [tag],
      confidence: 0.6,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Semantic clusters for common terms (used when first-word heuristic would split related tags).
 * E.g. "cash" and "credit" both map to "Financial".
 */
const SEMANTIC_CLUSTERS: Record<string, string> = {
  cash: 'Financial',
  credit: 'Financial',
  tax: 'Financial',
  payment: 'Financial',
  budget: 'Financial',
  invoice: 'Financial',
  cost: 'Financial',
  price: 'Financial',
  funding: 'Financial',
  renewable: 'Energy',
  solar: 'Energy',
  wind: 'Energy',
  energy: 'Energy',
  freeze: 'Process',
  thaw: 'Process',
  dewater: 'Process',
  pour: 'Process',
  record: 'Process',
};

/**
 * Group tags by semantic clusters first, then by common first word.
 * E.g. "cash", "credit" -> Financial; "tax", "tax credit" -> Financial; "freeze", "thaw" -> Process.
 */
function heuristicTagGrouping(tags: string[]): TagGroup[] {
  if (tags.length === 0) return [];
  const byCluster = new Map<string, string[]>();

  for (const tag of tags) {
    const lower = tag.toLowerCase();
    const firstWord = tag.split(/\s+/)[0]?.toLowerCase() || lower;
    const cluster = SEMANTIC_CLUSTERS[firstWord] ?? SEMANTIC_CLUSTERS[lower] ?? firstWord;
    const list = byCluster.get(cluster) ?? [];
    if (!list.includes(tag)) list.push(tag);
    byCluster.set(cluster, list);
  }

  return Array.from(byCluster.entries())
    .map(([name, groupTags]) => ({
      name,
      tags: groupTags.sort((a, b) => a.localeCompare(b)),
      confidence: 0.6,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
