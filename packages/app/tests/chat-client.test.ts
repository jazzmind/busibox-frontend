/**
 * Integration tests for Chat Client
 * 
 * These tests verify the new chat architecture client functions.
 * Requires AGENT_API_URL to be set in .env
 */

import {
  sendChatMessage,
  streamChatMessage,
  getAvailableModels,
  getConversationHistory,
  getConversations,
  createConversation,
  deleteConversation,
} from '../src/lib/agent/chat-client';
import { getAuthzToken } from './helpers/auth';

describe('Chat Client Integration Tests', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-123';
  let testConversationId: string | undefined;
  let authToken: string;

  beforeAll(async () => {
    // Get auth token for tests
    // Use empty scopes array - just need a valid token for the user
    authToken = await getAuthzToken(
      TEST_USER_ID,
      'agent-api',
      [] // No specific scopes required
    );
    console.log('✓ Got auth token for chat tests');
  });

  afterAll(async () => {
    // Clean up test conversation
    if (testConversationId) {
      try {
        await deleteConversation(testConversationId, { token: authToken });
        console.log('✓ Cleaned up test conversation');
      } catch (error) {
        console.warn('Failed to clean up test conversation:', error);
      }
    }
  });

  describe('Model Operations', () => {
    test('should get available models', async () => {
      const models = await getAvailableModels({ token: authToken });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Check model structure
      const firstModel = models[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');

      console.log(`✓ Found ${models.length} available models`);
    }, 30000);
  });

  describe('Conversation Management', () => {
    test('should create a new conversation', async () => {
      const conversation = await createConversation(
        'Test Conversation',
        { token: authToken }
      );

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
      expect(conversation.title).toBe('Test Conversation');

      testConversationId = conversation.id;
      console.log(`✓ Created conversation: ${conversation.id}`);
    }, 30000);

    test('should list conversations', async () => {
      const conversations = await getConversations({ token: authToken });

      expect(conversations).toBeDefined();
      expect(Array.isArray(conversations)).toBe(true);

      if (testConversationId) {
        const found = conversations.find((c) => c.id === testConversationId);
        expect(found).toBeDefined();
      }

      console.log(`✓ Found ${conversations.length} conversations`);
    }, 30000);
  });

  describe('Chat Message Operations', () => {
    test('should send a chat message (non-streaming)', async () => {
      if (!testConversationId) {
        throw new Error('No test conversation available');
      }

      const response = await sendChatMessage(
        {
          message: 'What is 2 + 2?',
          conversation_id: testConversationId,
          model: 'auto',
        },
        { token: authToken }
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.message_id).toBeDefined();
      expect(response.conversation_id).toBe(testConversationId);

      console.log(`✓ Got response: ${response.content.substring(0, 50)}...`);
    }, 60000);

    test('should stream a chat message', async () => {
      if (!testConversationId) {
        throw new Error('No test conversation available');
      }

      const chunks: string[] = [];
      let eventCount = 0;

      for await (const event of streamChatMessage(
        {
          message: 'Count from 1 to 3',
          conversation_id: testConversationId,
          model: 'auto',
        },
        { token: authToken }
      )) {
        eventCount++;
        
        if (event.type === 'content_chunk') {
          chunks.push(event.data.chunk);  // Server sends 'chunk' not 'content'
        }

        console.log(`Event ${eventCount}: ${event.type}`);
      }

      expect(eventCount).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(0);

      const fullContent = chunks.join('');
      expect(fullContent.length).toBeGreaterThan(0);

      console.log(`✓ Received ${eventCount} events, ${chunks.length} content chunks`);
      console.log(`✓ Full response: ${fullContent.substring(0, 100)}...`);
    }, 60000);

    test('should get conversation history', async () => {
      if (!testConversationId) {
        throw new Error('No test conversation available');
      }

      const history = await getConversationHistory(testConversationId, {
        token: authToken,
      });

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      // Should have at least our test messages
      const userMessages = history.filter((m) => m.role === 'user');
      const assistantMessages = history.filter((m) => m.role === 'assistant');

      expect(userMessages.length).toBeGreaterThan(0);
      expect(assistantMessages.length).toBeGreaterThan(0);

      console.log(`✓ History has ${history.length} messages (${userMessages.length} user, ${assistantMessages.length} assistant)`);
    }, 30000);
  });

  describe('Advanced Features', () => {
    test('should send message with web search enabled', async () => {
      if (!testConversationId) {
        throw new Error('No test conversation available');
      }

      const response = await sendChatMessage(
        {
          message: 'What is the current weather?',
          conversation_id: testConversationId,
          model: 'auto',
          enable_web_search: true,
        },
        { token: authToken }
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.message_id).toBeDefined();

      // Check if routing decision included web search
      if (response.routing_decision) {
        console.log(`✓ Routing decision: ${JSON.stringify(response.routing_decision)}`);
      }

      console.log(`✓ Response with web search: ${response.content.substring(0, 50)}...`);
    }, 60000);

    test('should send message with model selection', async () => {
      if (!testConversationId) {
        throw new Error('No test conversation available');
      }

      const response = await sendChatMessage(
        {
          message: 'Hello',
          conversation_id: testConversationId,
          model: 'chat', // Explicitly use chat model
        },
        { token: authToken }
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.message_id).toBeDefined();

      if (response.model) {
        console.log(`✓ Model used: ${response.model}`);
      }

      console.log(`✓ Response with specific model: ${response.content.substring(0, 50)}...`);
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle invalid conversation ID', async () => {
      await expect(
        sendChatMessage(
          {
            message: 'Test',
            conversation_id: 'invalid-id-12345',
            model: 'auto',
          },
          { token: authToken }
        )
      ).rejects.toThrow();
    }, 30000);

    test('should handle missing auth token', async () => {
      await expect(
        sendChatMessage(
          {
            message: 'Test',
            model: 'auto',
          },
          { token: '' }
        )
      ).rejects.toThrow();
    }, 30000);
  });
});

