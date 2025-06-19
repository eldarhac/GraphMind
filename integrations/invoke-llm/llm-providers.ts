import { callOpenAI } from './openai';

// Mock adapters for different LLM providers.

export type LLMProvider = "openai" | "gemini" | "claude";

const MOCK_LATENCY = {
  openai: 400,
  gemini: 500,
  claude: 600
};

function createMockResponse(prompt: string, provider: LLMProvider, schema?: any) {
  if (schema) {
    // If a JSON schema is requested, we create a structured response.
    // This mock is specifically tailored to the schema used in QueryProcessor.
    if (prompt.includes("intent")) {
      return JSON.stringify({
        intent: "find_path",
        entities: ["Dr. Evelyn Reed", "Dr. Marcus Thorne"],
        parameters: { target_person: "Dr. Evelyn Reed", topic: "AI" },
        confidence: Math.random() * 0.1 + 0.88 // 0.88 - 0.98
      });
    }
  }
  // Otherwise, return a generic text response that mentions the provider.
  return `This is a mock response from the ${provider} provider. Based on your query, the most influential person is Dr. Evelyn Reed.`;
}

export async function callProvider(prompt: string, provider: LLMProvider, schema?: any): Promise<any> {
  console.log(`[LLM Provider] Calling ${provider} with prompt...`);
  
  // If the provider is OpenAI, use the real service.
  if (provider === 'openai') {
    // The schema parameter is passed to ensure the OpenAI service knows
    // what JSON structure is expected.
    return callOpenAI(prompt, schema);
  }

  // Otherwise, use the mock providers for 'claude' or 'gemini'.
  await new Promise(resolve => setTimeout(resolve, MOCK_LATENCY[provider]));
  const mockResponse = createMockResponse(prompt, provider, schema);
  
  // The mock returns a string, so we parse it to simulate a real API response object.
  if (schema) {
    return JSON.parse(mockResponse);
  }
  return mockResponse;
} 