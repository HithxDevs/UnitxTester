import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google AI client
const googleAI = process.env.GOOGLE_API_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

// Gemini model priority list (Flash models have higher free tier limits)
const GEMINI_MODELS = [
  'gemini-1.5-flash',        // Best free tier limits
  'gemini-1.5-flash-latest', // Latest flash version
  'gemini-pro'               // Fallback
];

interface GenerateRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

export async function POST(request: Request) {
  // Verify API key exists
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "Google API key not configured" },
      { status: 500 }
    );
  }

  if (!googleAI) {
    return NextResponse.json(
      { error: "Google AI client initialization failed" },
      { status: 500 }
    );
  }

  try {
    const { 
      prompt, 
      maxTokens = 1000, 
      temperature = 0.7, 
      systemPrompt = "You are a helpful assistant that generates test cases for code. Always respond with valid JSON only, without any markdown formatting, explanations, or code blocks.",
      model
    }: GenerateRequest = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Use specified model or try models in priority order
    const modelsToTry = model ? [model] : GEMINI_MODELS;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const genModel = googleAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            maxOutputTokens: Math.min(maxTokens, 8192),
            temperature: Math.max(0, Math.min(2, temperature))
          }
        });

        // Combine system prompt and user prompt
        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

        const result = await genModel.generateContent(fullPrompt);
        const response = await result.response;
        
        if (!response.text()) {
          throw new Error('Empty response received');
        }

        // Clean up the response text - remove markdown code blocks if present
        let cleanedResult = response.text();
        
        // Remove ```json and ``` markers if present
        cleanedResult = cleanedResult.replace(/```json\s*/, '').replace(/```\s*$/, '');
        
        // Remove any leading/trailing whitespace
        cleanedResult = cleanedResult.trim();

        return NextResponse.json({
          result: cleanedResult,
          model_used: modelName,
          tokens_used: response.usageMetadata?.totalTokenCount || 0,
          input_tokens: response.usageMetadata?.promptTokenCount || 0,
          output_tokens: response.usageMetadata?.candidatesTokenCount || 0
        });

      } catch (error: any) {
        console.warn(`Model ${modelName} failed:`, error.message);
        lastError = error;
        
        // Don't retry if it's a quota/rate limit error - wait and use next model
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
          console.warn(`Quota exceeded for ${modelName}, trying next model...`);
          lastError = error;
          continue;
        }
        
        // Don't retry if it's a content policy violation
        if (error.message?.includes('SAFETY') || error.message?.includes('blocked')) {
          return NextResponse.json(
            { 
              error: "Content blocked by safety filters",
              details: error.message 
            },
            { status: 400 }
          );
        }
        
        continue;
      }
    }

    return NextResponse.json(
      {
        error: "All models failed",
        last_error: lastError?.message || "Unknown error",
        available_models: GEMINI_MODELS,
        suggestion: "Try adjusting your prompt or reducing maxTokens"
      },
      { status: 503 }
    );

  } catch (error: any) {
    console.error('API Handler Error:', error);
    
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

// Optional: Standalone function for direct use
export async function generateContent(
  prompt: string,
  options: Omit<GenerateRequest, 'prompt'> = {}
): Promise<string> {
  if (!googleAI) {
    throw new Error('Google AI not configured');
  }

  const {
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt = "You are a helpful assistant.",
    model = GEMINI_MODELS[0]
  } = options;

  const genModel = googleAI.getGenerativeModel({ 
    model,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature
    }
  });

  const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;
  const result = await genModel.generateContent(fullPrompt);
  const response = await result.response;
  
  return response.text();
}