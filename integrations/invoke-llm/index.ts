import { routeRequest } from './api-gateway';
import { getFromCache, setToCache } from './caching';

// This is the main, public-facing function.
export async function InvokeLLM(params: {
  prompt: string;
  response_json_schema?: any;
  add_context_from_internet?: boolean;
  file_urls?: string[];
  use_cache?: boolean; // Default to true
}) {
  const useCache = params.use_cache !== false;

  // 1. Check cache first
  if (useCache) {
    const cachedResponse = getFromCache(params);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  // 2. If not in cache, route the request through the gateway
  const response = await routeRequest(params);

  // 3. Store the new response in the cache
  if (useCache) {
    setToCache(params, response);
  }

  return response;
} 