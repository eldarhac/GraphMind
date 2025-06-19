import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_OPENAI_API_KEY is not set. Please add it to your .env file.");
}

const openai = new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

export async function callOpenAI(prompt: string, jsonSchema?: any): Promise<any> {
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: jsonSchema 
          ? "You are a helpful assistant designed to output JSON."
          : "You are a helpful and conversational assistant.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: messages,
      response_format: jsonSchema ? { type: "json_object" } : { type: "text" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI response content is empty.");
    }
    
    // If we requested JSON, we parse it. Otherwise, return the text directly.
    return jsonSchema ? JSON.parse(content) : content;

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    // In a real app, you might want more sophisticated error handling,
    // like falling back to a different provider or returning a custom error object.
    throw error;
  }
} 