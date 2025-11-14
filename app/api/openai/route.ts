import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google AI client
const googleAI = process.env.GOOGLE_API_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

// Gemini model priority list
// Updated: Google has deprecated gemini-1.5 models and now only supports Gemini 2.x models
// Models must include the "models/" prefix for the API
const GEMINI_MODELS = [
  'models/gemini-2.5-flash',        // Latest flash model - best for free tier
  'models/gemini-2.5-pro',           // Latest pro model
  'models/gemini-2.0-flash',         // 2.0 flash model
  'models/gemini-2.0-flash-001',    // 2.0 flash variant
  'models/gemini-2.0-flash-lite-001' // Lite variant
];

interface GenerateRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

// Helper function to list available models (for debugging)
async function listAvailableModels(): Promise<string[]> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return [];
    
    // Try v1 API first
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    if (response.ok) {
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
  return [];
}

// Helper function to try REST API v1 directly
async function tryRestAPIv1(
  modelName: string,
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<{ success: boolean; result?: any; error?: any }> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'No API key' };
    }

    const cleanModelName = modelName.replace(/^models\//, '');
    const restResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${cleanModelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            maxOutputTokens: Math.min(maxTokens, 8192),
            temperature: Math.max(0, Math.min(2, temperature))
          }
        })
      }
    );

    if (restResponse.ok) {
      const restData = await restResponse.json();
      const text = restData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        let cleanedResult = text;
        cleanedResult = cleanedResult.replace(/```json\s*/, '').replace(/```\s*$/, '');
        cleanedResult = cleanedResult.trim();
        
        return {
          success: true,
          result: {
            text: cleanedResult,
            usageMetadata: restData.usageMetadata
          }
        };
      }
    } else {
      const errorData = await restResponse.json();
      return { success: false, error: errorData };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
  
  return { success: false, error: 'Unknown error' };
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

    // Combine system prompt and user prompt
    const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

    // First, try to get available models and use them if possible
    const availableModels = await listAvailableModels();
    let modelsToTry: string[] = [];
    
    if (model) {
      modelsToTry = [model];
    } else if (availableModels.length > 0) {
      // Filter to only Gemini models that support generateContent
      const geminiModels = availableModels.filter((m: string) => 
        m.includes('gemini') && !m.includes('embedding')
      );
      if (geminiModels.length > 0) {
        modelsToTry = geminiModels.slice(0, 3); // Use first 3 available
      } else {
        modelsToTry = GEMINI_MODELS; // Fallback to hardcoded
      }
    } else {
      modelsToTry = GEMINI_MODELS; // Fallback to hardcoded
    }

    let lastError = null;

    // Try SDK first for each model
    for (const modelName of modelsToTry) {
      try {
        // SDK may accept model names with or without "models/" prefix
        // Try with prefix first (as required by newer API)
        const modelNameForSDK = modelName.includes('/') ? modelName : `models/${modelName}`;
        const cleanModelName = modelName.replace(/^models\//, ''); // For REST API URL
        console.log(`Attempting SDK with model: ${modelNameForSDK}`);
        
        const genModel = googleAI.getGenerativeModel({ 
          model: modelNameForSDK,
          generationConfig: {
            maxOutputTokens: Math.min(maxTokens, 8192),
            temperature: Math.max(0, Math.min(2, temperature))
          }
        });

        const result = await genModel.generateContent(fullPrompt);
        const response = await result.response;
        
        if (!response.text()) {
          throw new Error('Empty response received');
        }

        let cleanedResult = response.text();
        cleanedResult = cleanedResult.replace(/```json\s*/, '').replace(/```\s*$/, '');
        cleanedResult = cleanedResult.trim();

        return NextResponse.json({
          result: cleanedResult,
          model_used: cleanModelName,
          method: 'SDK',
          tokens_used: response.usageMetadata?.totalTokenCount || 0,
          input_tokens: response.usageMetadata?.promptTokenCount || 0,
          output_tokens: response.usageMetadata?.candidatesTokenCount || 0
        });

      } catch (error: any) {
        console.warn(`SDK model ${modelName} failed:`, error.message);
        lastError = error;
        
        // Don't retry if it's a quota/rate limit error
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
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
      }
    }

    // If SDK failed, try REST API v1 for all models
    console.log('SDK methods failed, trying REST API v1 for all models...');
    for (const modelName of modelsToTry) {
      const cleanModelName = modelName.replace(/^models\//, '');
      console.log(`Attempting REST API v1 with model: ${cleanModelName}`);
      
      const restResult = await tryRestAPIv1(cleanModelName, fullPrompt, maxTokens, temperature);
      
      if (restResult.success && restResult.result) {
        return NextResponse.json({
          result: restResult.result.text,
          model_used: cleanModelName,
          method: 'REST API v1',
          tokens_used: restResult.result.usageMetadata?.totalTokenCount || 0,
          input_tokens: restResult.result.usageMetadata?.promptTokenCount || 0,
          output_tokens: restResult.result.usageMetadata?.candidatesTokenCount || 0
        });
      } else {
        console.warn(`REST API v1 model ${cleanModelName} failed:`, restResult.error);
        if (restResult.error) {
          lastError = restResult.error;
        }
      }
    }

    // If all methods failed, return detailed error
    // Use already fetched availableModels, or fetch again if empty
    const finalAvailableModels = availableModels.length > 0 ? availableModels : await listAvailableModels();
    
    return NextResponse.json(
      {
        error: "All models failed",
        last_error: lastError?.message || lastError?.error?.message || "Unknown error",
        attempted_models: modelsToTry,
        available_models_from_api: finalAvailableModels.length > 0 ? finalAvailableModels : "Could not fetch available models",
        suggestion: finalAvailableModels.length > 0 
          ? `Try using one of these available models: ${finalAvailableModels.slice(0, 5).join(', ')}`
          : "Try adjusting your prompt or reducing maxTokens. Also verify your API key has access to Generative Language API and that the models are enabled in your Google Cloud project."
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