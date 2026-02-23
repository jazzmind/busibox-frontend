/**
 * Web Search Providers (busibox-portal wrapper)
 *
 * Re-exports search client and config helpers. Direct provider classes
 * (TavilyProvider, etc.) were removed; use searchWeb() from the client instead.
 */

export {
  searchWeb,
  type WebSearchResult,
  type WebSearchResponse,
  type WebSearchOptions,
} from '@jazzmind/busibox-app/lib/search';

export { initializeSearchProviders, clearSearchProviderCache } from './config';
