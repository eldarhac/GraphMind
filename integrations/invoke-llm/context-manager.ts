// Mocks for augmenting prompts with external context.

async function searchInternet(query: string): Promise<string> {
  console.log(`[Context Manager] Mock searching internet for: "${query}"`);
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  return `
    --- INTERNET SEARCH RESULTS ---
    - Finding 1: According to a recent study, network visualization is crucial for understanding complex relationships.
    - Finding 2: Key influencers in a network can be identified by their centrality and connection strength.
    --- END SEARCH ---
  `;
}

async function extractFileContent(fileUrl: string): Promise<string> {
  console.log(`[Context Manager] Mock extracting content from: "${fileUrl}"`);
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate file processing delay
  return `
    --- FILE CONTENT for ${fileUrl} ---
    This file contains a list of project members and their roles. Dr. Evelyn Reed is listed as the project lead.
    --- END FILE ---
  `;
}

export async function augmentPrompt(
  originalPrompt: string,
  add_context_from_internet?: boolean,
  file_urls?: string[]
): Promise<string> {
  let augmentedPrompt = originalPrompt;

  if (add_context_from_internet) {
    // In a real app, we'd extract keywords from the prompt for a better search
    const searchContext = await searchInternet(originalPrompt.substring(0, 100));
    augmentedPrompt = `${searchContext}\n\n${augmentedPrompt}`;
  }

  if (file_urls && file_urls.length > 0) {
    const fileContexts = await Promise.all(file_urls.map(extractFileContent));
    augmentedPrompt = `${fileContexts.join("\n")}\n\n${augmentedPrompt}`;
  }

  return augmentedPrompt;
} 