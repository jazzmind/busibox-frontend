/**
 * Unit tests for Search API Client
 * 
 * These tests mock the search-api HTTP endpoints.
 * No external API keys required.
 */

import { searchWeb, getAvailableProviders, getProviderStatus } from '../src/lib/search/client';

// Mock fetch globally
global.fetch = jest.fn();

describe('Search API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchWeb', () => {
    test('should call search-api with correct parameters', async () => {
      const mockResponse = {
        query: 'test query',
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            snippet: 'Test snippet',
            score: 0.9,
          },
        ],
        provider: 'duckduckgo',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: {},
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchWeb('test query', {
        maxResults: 5,
        provider: 'duckduckgo',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/web-search'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('test query'),
        })
      );

      expect(result).toEqual(mockResponse);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Test Result');
    });

    test('should include authorization header when tokenManager provided', async () => {
      const mockResponse = {
        query: 'test',
        results: [],
        provider: 'duckduckgo',
        timestamp: '2024-01-01T00:00:00Z',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const mockTokenManager = {
        getAuthzToken: jest.fn().mockResolvedValue('mock-token'),
      };

      await searchWeb('test', {}, mockTokenManager);

      expect(mockTokenManager.getAuthzToken).toHaveBeenCalledWith(
        'search-api',
        []
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    test('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid provider' }),
      });

      await expect(searchWeb('test', { provider: 'invalid' })).rejects.toThrow(
        'Web search failed: Invalid provider'
      );
    });

    test('should proceed without auth if token fetch fails', async () => {
      const mockResponse = {
        query: 'test',
        results: [],
        provider: 'duckduckgo',
        timestamp: '2024-01-01T00:00:00Z',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const mockTokenManager = {
        getAuthzToken: jest.fn().mockRejectedValue(new Error('Auth failed')),
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await searchWeb('test', {}, mockTokenManager);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get auth token'),
        expect.any(Error)
      );

      // Should still make the request without auth
      expect(global.fetch).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getAvailableProviders', () => {
    test('should return list of enabled providers', async () => {
      const mockProviders = [
        { provider_name: 'duckduckgo', is_enabled: true, is_configured: true },
        { provider_name: 'tavily', is_enabled: true, is_configured: true },
        { provider_name: 'bing', is_enabled: false, is_configured: true },
        { provider_name: 'serpapi', is_enabled: true, is_configured: false },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProviders,
      });

      const result = await getAvailableProviders();

      expect(result).toEqual(['duckduckgo', 'tavily']);
      expect(result).not.toContain('bing'); // disabled
      expect(result).not.toContain('serpapi'); // not configured
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(getAvailableProviders()).rejects.toThrow(
        'Failed to get providers'
      );
    });
  });

  describe('getProviderStatus', () => {
    test('should return provider status', async () => {
      const mockStatus = {
        provider_name: 'tavily',
        is_enabled: true,
        is_configured: true,
        status: 'ready',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const result = await getProviderStatus('tavily');

      expect(result).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/web-search/providers/tavily'),
        expect.any(Object)
      );
    });

    test('should handle not found errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(getProviderStatus('unknown')).rejects.toThrow(
        'Failed to get provider status'
      );
    });
  });
});

