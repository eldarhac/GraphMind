// A simple in-memory cache for LLM responses.
// In a real production environment, this would likely be a distributed cache like Redis.

const cache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateCacheKey(params: any): string {
  // Create a stable, sorted key from the request parameters
  try {
    return JSON.stringify(Object.keys(params).sort().reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as any));
  } catch (e) {
    // Fallback for non-serializable params
    return params.prompt;
  }
}

export function getFromCache(params: any): any | null {
  const key = generateCacheKey(params);
  const cached = cache.get(key);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log("CACHE HIT");
    return cached.response;
  }

  console.log("CACHE MISS");
  return null;
}

export function setToCache(params: any, response: any): void {
  const key = generateCacheKey(params);
  cache.set(key, { response, timestamp: Date.now() });
} 