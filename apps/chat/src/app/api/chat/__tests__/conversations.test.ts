/**
 * Chat Conversations API Tests
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../conversations/route';
import { getUserConversations, createConversation } from '@jazzmind/busibox-app/lib/agent/chat-conversations';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';

// Mock dependencies
vi.mock('@/lib/middleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/chat/conversations', () => ({
  getUserConversations: vi.fn(),
  createConversation: vi.fn(),
}));

describe('Chat Conversations API', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockRequest = (url: string, method: string = 'GET', body?: any) => {
    const request = new NextRequest(url, {
      method,
      ...(body && { body: JSON.stringify(body) }),
      ...(body && { headers: { 'Content-Type': 'application/json' } }),
    });
    return request;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ user: mockUser });
  });

  describe('GET /api/chat/conversations', () => {
    it('should return paginated conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Test',
          messageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (getUserConversations as any).mockResolvedValue({
        conversations: mockConversations,
        total: 1,
        page: 1,
        limit: 20,
      });

      const request = mockRequest('http://localhost/api/chat/conversations?page=1&limit=20');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
      expect(getUserConversations).toHaveBeenCalledWith({
        userId: mockUser.id,
        page: 1,
        limit: 20,
        includeShared: true,
      });
    });

    it('should handle authentication failure', async () => {
      (requireAuth as any).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      );

      const request = mockRequest('http://localhost/api/chat/conversations');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should use default pagination', async () => {
      (getUserConversations as any).mockResolvedValue({
        conversations: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const request = mockRequest('http://localhost/api/chat/conversations');
      await GET(request);

      expect(getUserConversations).toHaveBeenCalledWith({
        userId: mockUser.id,
        page: 1,
        limit: 20,
        includeShared: true,
      });
    });
  });

  describe('POST /api/chat/conversations', () => {
    it('should create a new conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        ownerId: mockUser.id,
        title: 'New Conversation',
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (createConversation as any).mockResolvedValue(mockConversation);

      const request = mockRequest(
        'http://localhost/api/chat/conversations',
        'POST',
        {}
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('conv-123');
      expect(createConversation).toHaveBeenCalledWith(
        mockUser.id,
        undefined,
        false
      );
    });

    it('should create conversation with custom title', async () => {
      const mockConversation = {
        id: 'conv-123',
        ownerId: mockUser.id,
        title: 'Custom Title',
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (createConversation as any).mockResolvedValue(mockConversation);

      const request = mockRequest(
        'http://localhost/api/chat/conversations',
        'POST',
        { title: 'Custom Title' }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(data.title).toBe('Custom Title');
      expect(createConversation).toHaveBeenCalledWith(
        mockUser.id,
        'Custom Title',
        false
      );
    });

    it('should create private conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        ownerId: mockUser.id,
        title: 'Private',
        isPrivate: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (createConversation as any).mockResolvedValue(mockConversation);

      const request = mockRequest(
        'http://localhost/api/chat/conversations',
        'POST',
        { isPrivate: true }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(data.isPrivate).toBe(true);
    });

    it('should validate title type', async () => {
      const request = mockRequest(
        'http://localhost/api/chat/conversations',
        'POST',
        { title: 123 }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Title must be a string');
    });

    it('should validate isPrivate type', async () => {
      const request = mockRequest(
        'http://localhost/api/chat/conversations',
        'POST',
        { isPrivate: 'true' }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('isPrivate must be a boolean');
    });
  });
});

