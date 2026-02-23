/**
 * Conversation Detail API Tests
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '../conversations/[id]/route';
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from '@jazzmind/busibox-app/lib/agent/chat-conversations';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';

// Mock dependencies
vi.mock('@/lib/middleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/chat/conversations', () => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
}));

describe('Conversation Detail API', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockConversationId = 'conv-123';

  const mockRequest = (method: string, body?: any) => {
    const url = `http://localhost/api/chat/conversations/${mockConversationId}`;
    return new NextRequest(url, {
      method,
      ...(body && { body: JSON.stringify(body) }),
      ...(body && { headers: { 'Content-Type': 'application/json' } }),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ user: mockUser });
  });

  describe('GET /api/chat/conversations/[id]', () => {
    it('should return conversation with messages', async () => {
      const mockConversation = {
        id: mockConversationId,
        title: 'Test',
        messages: [{ id: 'msg-1', content: 'Hello' }],
      };

      (getConversation as any).mockResolvedValue(mockConversation);

      const request = mockRequest('GET');
      const response = await GET(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockConversationId);
      expect(getConversation).toHaveBeenCalledWith(
        mockConversationId,
        mockUser.id,
        true
      );
    });

    it('should return 404 if conversation not found', async () => {
      (getConversation as any).mockResolvedValue(null);

      const request = mockRequest('GET');
      const response = await GET(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('PATCH /api/chat/conversations/[id]', () => {
    it('should update conversation title', async () => {
      const updated = {
        id: mockConversationId,
        title: 'Updated Title',
        isPrivate: false,
      };

      (updateConversation as any).mockResolvedValue(updated);

      const request = mockRequest('PATCH', { title: 'Updated Title' });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Title');
      expect(updateConversation).toHaveBeenCalledWith(
        mockConversationId,
        mockUser.id,
        { title: 'Updated Title', isPrivate: undefined }
      );
    });

    it('should return 403 if not owner', async () => {
      (updateConversation as any).mockResolvedValue(null);

      const request = mockRequest('PATCH', { title: 'Updated' });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('permission');
    });

    it('should validate input types', async () => {
      const request = mockRequest('PATCH', { title: 123 });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Title must be a string');
    });
  });

  describe('DELETE /api/chat/conversations/[id]', () => {
    it('should delete conversation if owner', async () => {
      (deleteConversation as any).mockResolvedValue(true);

      const request = mockRequest('DELETE');
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(mockConversationId);
    });

    it('should return 403 if not owner', async () => {
      (deleteConversation as any).mockResolvedValue(false);

      const request = mockRequest('DELETE');
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('permission');
    });
  });
});

