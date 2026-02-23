import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Lazy initialization of liteLLM client (only when needed)
function getLiteLLMClient() {
  return new OpenAI({
    apiKey: process.env.LITELLM_API_KEY || 'sk-litellm-master-key-change-me',
    baseURL: process.env.LITELLM_BASE_URL || 'http://localhost:4000/v1',
  });
}

// POST /api/videos/title - Generate a short title from a prompt
export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!process.env.LITELLM_BASE_URL) {
      return NextResponse.json(
        { error: 'LiteLLM not configured' },
        { status: 500 }
      );
    }

    // Generate a concise title using liteLLM
    // Default to 'chat' model or use environment override
    const titleModel = process.env.MODEL_TITLE || 'chat';
    const litellm = getLiteLLMClient();
    
    const response = await litellm.chat.completions.create({
      model: titleModel,
      messages: [
        {
          role: "system",
          content: "Generate a short, descriptive 3-5 word title for a video based on its description. Be concise and catchy. Only return the title, no quotes or extra text."
        },
        {
          role: "user",
          content: prompt.trim()
        }
      ],
      max_tokens: 20,
      temperature: 0.7,
    });

    const title = response.choices[0]?.message?.content?.trim() || 'Untitled Video';

    return NextResponse.json({
      success: true,
      title,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; error?: unknown };
    console.error('Title generation error:', err);
    
    return NextResponse.json(
      { 
        error: err?.message || 'Failed to generate title',
        details: err?.error || undefined
      },
      { status: err?.status || 500 }
    );
  }
}


