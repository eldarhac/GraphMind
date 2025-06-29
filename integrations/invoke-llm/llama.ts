const llamaApiUrl = "https://autumn-breeze-366e.eldar-hacohen.workers.dev/";

async function llamaChat(messages: { role: string; content: string }[]): Promise<any> {
  const res = await fetch(llamaApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`LLaMA API request failed with status ${res.status}: ${errorBody}`);
  }
  const json = await res.json();
  // The user specified the response is in json.response.response
  if (json && json.response && typeof json.response.response !== 'undefined') {
    return json.response.response;
  }
  throw new Error("Invalid response structure from LLaMA API");
}

export async function callLlama(prompt: string, jsonSchema?: any): Promise<any> {
  try {
    const messages: { role: string; content: string }[] = [
      {
        role: "system",
        content: jsonSchema 
          ? "You are a helpful assistant designed to output JSON. Respond with only the JSON object, without any extra text or explanations."
          : "You are a helpful and conversational assistant.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await llamaChat(messages);
    
    // Log the raw response for debugging purposes
    console.log("Raw response from LLaMA worker:", response);

    if (jsonSchema) {
      if (typeof response !== 'string' || response.trim() === '') {
        throw new Error("Received an empty or invalid response from the LLaMA API when JSON was expected.");
      }
      
      try {
        // First, try to parse the response directly.
        return JSON.parse(response);
      } catch (e) {
        // If parsing fails, the JSON might be embedded in a markdown code block.
        console.log("Initial JSON.parse failed. Checking for markdown-formatted JSON...");
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch && jsonMatch[1]) {
          try {
            return JSON.parse(jsonMatch[1]);
          } catch (e2) {
            console.error("Failed to parse extracted JSON from markdown block:", e2);
            throw new Error(`The model response was not valid JSON, even after extracting from a markdown block. Raw response: ${response}`);
          }
        }
        
        console.error("Error parsing LLaMA response as JSON:", e);
        throw new Error(`The model response was not valid JSON. Raw response: ${response}`);
      }
    }
    
    return response;

  } catch (error) {
    console.error("Error calling LLaMA API:", error);
    throw error;
  }
} 