import { augmentPrompt } from './context-manager';
import { callProvider, LLMProvider } from './llm-providers';

// Mock API Gateway. In a real app, this would be a backend service.
export async function routeRequest(params: {
  prompt: string;
  response_json_schema?: any;
  add_context_from_internet?: boolean;
  file_urls?: string[];
}) {
  console.log("[API Gateway] Received request.");

  // 1. Mock Authentication & Context Injection
  const appId = "graphmind-app-123";
  const appOwner = "user-abc-456";
  console.log(`[API Gateway] Authenticated for app: ${appId}, owner: ${appOwner}`);

  // 2. Mock Rate Limiting (just a console log here)
  console.log("[API Gateway] Rate limit check passed.");

  // 3. Augment prompt with context
  const finalPrompt = await augmentPrompt(
    params.prompt,
    params.add_context_from_internet,
    params.file_urls
  );

  // 4. Mock Routing to an LLM provider
  // Simple logic: if 'claude' is in prompt, use claude, otherwise default to openai.
  const provider: LLMProvider = finalPrompt.toLowerCase().includes('claude') ? 'claude' : 'openai';
  console.log(`[API Gateway] Routing to provider: ${provider}`);
  const rawResponse = await callProvider(finalPrompt, provider, params.response_json_schema);


  return rawResponse;
} 