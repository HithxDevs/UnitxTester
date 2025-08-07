import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Updated model priority list based on your available models
const MODEL_PRIORITY_LIST = [
  "gpt-4.1",          // Your newest available model
  "gpt-4o",           // Omni model
  "gpt-4.1-mini",     // Smaller version
  "gpt-3.5-turbo",    // Fallback
  "gpt-3.5-turbo-16k" // Larger context fallback
];

export async function POST(request: Request) {
  // Verify API key exists
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { prompt, maxTokens = 1000 } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    let lastError = null;
    
    for (const model of MODEL_PRIORITY_LIST) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { 
              role: "system", 
              content: "You are a helpful assistant that generates test cases for code." 
            },
            { role: "user", content: prompt }
          ],
          max_tokens: Math.min(maxTokens, 4000), // Increased limit for GPT-4 models
          temperature: 0.7,
        });

        return NextResponse.json({
          result: completion.choices[0]?.message?.content || "",
          model_used: model,
          tokens_used: completion.usage?.total_tokens
        });
        
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    return NextResponse.json(
      {
        error: "All models failed",
        last_error: lastError?.message || "Unknown error",
        available_models: MODEL_PRIORITY_LIST
      },
      { status: 503 }
    );

  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Processing error",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}