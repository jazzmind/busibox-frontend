/**
 * Unit tests for Insights API Client
 * 
 * These tests mock the search-api HTTP endpoints.
 * No external API keys or Milvus required.
 */

import {
  initializeChatInsightsCollection,
  insertInsights,
  searchInsights,
  deleteConversationInsights,
  getUserInsightCount,
  deleteUserInsights,
  flushInsightsCollection,
  getCollectionStats,
  checkInsightsHealth,
  type ChatInsight,
} from '../src/lib/agent/insights';

// Mock fetch globally
global.fetch = jest.fn();

describe('Insights API Client', () => {
  const mockTokenManager = {
    getAuthzToken: jest.fn().mockResolvedValue('mock-token'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeChatInsightsCollection', () => {
    test('should initialize collection successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Collection initialized successfully' }),
      });

      await initializeChatInsightsCollection(mockTokenManager);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/init'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    test('should work without token manager', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Collection initialized successfully' }),
      });

      await initializeChatInsightsCollection();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/init'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Failed to create collection' }),
      });

      await expect(initializeChatInsightsCollection()).rejects.toThrow(
        'Failed to initialize collection: Failed to create collection'
      );
    });
  });

  describe('insertInsights', () => {
    const mockInsights: ChatInsight[] = [
      {
        id: 'insight-1',
        userId: 'user-123',
        content: 'Important insight from conversation',
        embedding: new Array(1024).fill(0.1),
        conversationId: 'conv-123',
        analyzedAt: Date.now(),
      },
      {
        id: 'insight-2',
        userId: 'user-123',
        content: 'Another insight',
        embedding: new Array(1024).fill(0.2),
        conversationId: 'conv-123',
        analyzedAt: Date.now(),
      },
    ];

    test('should insert insights successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Successfully inserted 2 insights', count: 2 }),
      });

      await insertInsights(mockInsights, mockTokenManager);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('insight-1'),
        })
      );
    });

    test('should skip insertion for empty array', async () => {
      await insertInsights([], mockTokenManager);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid insight data' }),
      });

      await expect(insertInsights(mockInsights)).rejects.toThrow(
        'Failed to insert insights: Invalid insight data'
      );
    });
  });

  describe('searchInsights', () => {
    const mockResults = [
      {
        id: 'insight-1',
        userId: 'user-123',
        content: 'Relevant insight',
        conversationId: 'conv-123',
        analyzedAt: '2024-01-01T00:00:00Z',
        score: 0.15,
      },
      {
        id: 'insight-2',
        userId: 'user-123',
        content: 'Another relevant insight',
        conversationId: 'conv-456',
        analyzedAt: '2024-01-02T00:00:00Z',
        score: 0.25,
      },
    ];

    test('should search insights successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'test query',
          results: mockResults,
          count: 2,
        }),
      });

      const results = await searchInsights('test query', 'user-123', {}, mockTokenManager);

      expect(results).toEqual(mockResults);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/search'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
          body: expect.stringContaining('test query'),
        })
      );
    });

    test('should use custom options', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ query: 'test', results: [], count: 0 }),
      });

      await searchInsights('test', 'user-123', {
        limit: 10,
        scoreThreshold: 0.5,
      });

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.limit).toBe(10);
      expect(callBody.scoreThreshold).toBe(0.5);
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Search failed' }),
      });

      await expect(searchInsights('test', 'user-123')).rejects.toThrow(
        'Failed to search insights: Search failed'
      );
    });
  });

  describe('deleteConversationInsights', () => {
    test('should delete conversation insights successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Deleted insights for conversation conv-123' }),
      });

      await deleteConversationInsights('conv-123', 'user-123', mockTokenManager);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/conversation/conv-123'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Conversation not found' }),
      });

      await expect(deleteConversationInsights('conv-123', 'user-123')).rejects.toThrow(
        'Failed to delete conversation insights: Conversation not found'
      );
    });
  });

  describe('getUserInsightCount', () => {
    test('should get user insight count successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 'user-123', count: 42, collectionName: 'chat_insights' }),
      });

      const count = await getUserInsightCount('user-123', mockTokenManager);

      expect(count).toBe(42);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/stats/user-123'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ detail: 'Access denied' }),
      });

      await expect(getUserInsightCount('user-123')).rejects.toThrow(
        'Failed to get user insight count: Access denied'
      );
    });
  });

  describe('deleteUserInsights', () => {
    test('should delete user insights successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Deleted all insights for user user-123' }),
      });

      await deleteUserInsights('user-123', mockTokenManager);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/user/user-123'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ detail: 'Cannot delete insights for other users' }),
      });

      await expect(deleteUserInsights('user-123')).rejects.toThrow(
        'Failed to delete user insights: Cannot delete insights for other users'
      );
    });
  });

  describe('flushInsightsCollection', () => {
    test('should flush collection successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Collection flushed successfully' }),
      });

      await flushInsightsCollection(mockTokenManager);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/flush'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Flush failed' }),
      });

      await expect(flushInsightsCollection()).rejects.toThrow(
        'Failed to flush collection: Flush failed'
      );
    });
  });

  describe('getCollectionStats', () => {
    test('should get collection stats successfully', async () => {
      const mockStats = {
        userId: 'user-123',
        count: 42,
        collectionName: 'chat_insights',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const stats = await getCollectionStats('user-123', mockTokenManager);

      expect(stats).toEqual(mockStats);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/insights/stats/user-123'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ detail: 'User not found' }),
      });

      await expect(getCollectionStats('user-123')).rejects.toThrow(
        'Failed to get collection stats: User not found'
      );
    });
  });

  describe('checkInsightsHealth', () => {
    test('should return true when service is healthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', milvus: 'connected' }),
      });

      const isHealthy = await checkInsightsHealth();

      expect(isHealthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    test('should return true when service is degraded', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'degraded', milvus: 'connected' }),
      });

      const isHealthy = await checkInsightsHealth();

      expect(isHealthy).toBe(true);
    });

    test('should return false when service is unhealthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'unhealthy', milvus: 'unavailable' }),
      });

      const isHealthy = await checkInsightsHealth();

      expect(isHealthy).toBe(false);
    });

    test('should return false on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      const isHealthy = await checkInsightsHealth();

      expect(isHealthy).toBe(false);
    });

    test('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const isHealthy = await checkInsightsHealth();

      expect(isHealthy).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Token Manager Integration', () => {
    test('should proceed without auth if token fetch fails', async () => {
      const failingTokenManager = {
        getAuthzToken: jest.fn().mockRejectedValue(new Error('Auth service down')),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ query: 'test', results: [], count: 0 }),
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await searchInsights('test', 'user-123', {}, failingTokenManager);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get auth token'),
        expect.any(Error)
      );

      // Should still make the request without auth
      expect(global.fetch).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

