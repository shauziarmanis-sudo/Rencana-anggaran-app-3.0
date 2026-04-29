// ============================================================
// Emdedding utilities for Chatbot RAG using OpenAI
// ============================================================

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const prisma = new PrismaClient();

// Number of records to return from a semantic search
const SEARCH_LIMIT = 5;

/**
 * Generate embedding using text-embedding-3-small
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) throw new Error('OPENAI_API_KEY is missing');
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.replace(/\n/g, ' '), // It's a good practice to put everything on a single line
    encoding_format: "float",
  });
  
  return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top K most similar texts in the database
 */
export async function searchSimilar(queryText: string, topK: number = SEARCH_LIMIT) {
  if (!openai) return [];
  
  try {
    const queryVector = await generateEmbedding(queryText);
    
    // Fetch all embeddings (we expect them to be small enough to stay in memory: < 10,000)
    // If it ever gets bigger, we might need pgvector or external vector DB 
    // but for TiDB MySQL, this works fine for smaller datasets up to 10-50K records
    const allEmbeddings = await prisma.embedding.findMany({
      select: {
        id: true,
        sourceType: true,
        content: true,
        vector: true,
      }
    });
    
    const similarities = allEmbeddings.map(emb => {
      try {
        const vector = JSON.parse(emb.vector) as number[];
        const score = cosineSimilarity(queryVector, vector);
        return { 
          sourceType: emb.sourceType, 
          content: emb.content, 
          similarity: score 
        };
      } catch (e) {
        return { sourceType: '', content: '', similarity: 0 };
      }
    });

    return similarities
      .filter(item => item.similarity > 0.3) // threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  } catch (err) {
    console.error('Error in searchSimilar:', err);
    return [];
  }
}
