/**
 * Integration tests for Embeddings Client
 * 
 * These tests make real calls to the data service's embeddings endpoint.
 * Requires DATA_API_HOST and DATA_API_PORT to be set in .env
 */

import {
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingsConfigured,
  getEmbeddingDimension,
} from '../src/lib/data/embeddings';
import { getAuthzToken } from './helpers/auth';

describe('Embeddings Client Integration Tests', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-123';

  describe('Configuration', () => {
    test('should be configured', () => {
      expect(isEmbeddingsConfigured()).toBe(true);
    });

    test('should return correct embedding dimension', () => {
      expect(getEmbeddingDimension()).toBe(1024);
    });
  });

  describe('Single Embedding Generation', () => {
    test('should generate embedding for single text', async () => {
      const text = 'This is a test sentence for embedding generation.';

      const embedding = await generateEmbedding(text, {
        userId: TEST_USER_ID,
        getAuthzToken,
      });

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1024); // bge-large-en-v1.5 dimension
      expect(typeof embedding[0]).toBe('number');

      console.log(`Generated embedding with ${embedding.length} dimensions`);
      console.log(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    });

    test('should generate different embeddings for different texts', async () => {
      const text1 = 'The quick brown fox jumps over the lazy dog.';
      const text2 = 'Machine learning is a subset of artificial intelligence.';

      const [embedding1, embedding2] = await Promise.all([
        generateEmbedding(text1, { userId: TEST_USER_ID, getAuthzToken }),
        generateEmbedding(text2, { userId: TEST_USER_ID, getAuthzToken }),
      ]);

      expect(embedding1).not.toEqual(embedding2);
      
      // Calculate cosine similarity (should be low for different topics)
      const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      const mag1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      const mag2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (mag1 * mag2);

      console.log(`Cosine similarity between different texts: ${similarity.toFixed(4)}`);
      expect(similarity).toBeLessThan(0.9); // Different topics should have lower similarity
    });

    test('should generate similar embeddings for similar texts', async () => {
      const text1 = 'The cat sat on the mat.';
      const text2 = 'A cat was sitting on a mat.';

      const [embedding1, embedding2] = await Promise.all([
        generateEmbedding(text1, { userId: TEST_USER_ID, getAuthzToken }),
        generateEmbedding(text2, { userId: TEST_USER_ID, getAuthzToken }),
      ]);

      // Calculate cosine similarity (should be high for similar texts)
      const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      const mag1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      const mag2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (mag1 * mag2);

      console.log(`Cosine similarity between similar texts: ${similarity.toFixed(4)}`);
      expect(similarity).toBeGreaterThan(0.7); // Similar texts should have high similarity
    });
  });

  describe('Batch Embedding Generation', () => {
    test('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First test sentence.',
        'Second test sentence.',
        'Third test sentence.',
      ];

      const embeddings = await generateEmbeddings(texts, {
        userId: TEST_USER_ID,
        getAuthzToken,
      });

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
      
      embeddings.forEach((embedding, index) => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1024);
        console.log(`Embedding ${index + 1}: ${embedding.length} dimensions`);
      });
    });

    test('should handle empty array', async () => {
      const embeddings = await generateEmbeddings([], {
        userId: TEST_USER_ID,
        getAuthzToken,
      });

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(0);
    });

    test('should handle large batch', async () => {
      const texts = Array.from({ length: 10 }, (_, i) => `Test sentence number ${i + 1}.`);

      const embeddings = await generateEmbeddings(texts, {
        userId: TEST_USER_ID,
        getAuthzToken,
      });

      expect(embeddings.length).toBe(10);
      console.log(`Generated ${embeddings.length} embeddings in batch`);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors', async () => {
      await expect(
        generateEmbedding('test', {
          userId: TEST_USER_ID,
          getAuthzToken,
          dataUrl: 'http://invalid-host:9999',
        })
      ).rejects.toThrow();
    });

    test('should handle empty text', async () => {
      const embedding = await generateEmbedding('', {
        userId: TEST_USER_ID,
        getAuthzToken,
      });

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1024);
    });
  });
});

