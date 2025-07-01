import { LLM, BaseLLMParams } from "@langchain/core/language_models/llms";
import { callLlama } from "./llama";

/**
 * A custom LangChain LLM wrapper for the LLaMA model.
 * This class allows LangChain to invoke the custom LLaMA setup
 * via the existing `callLlama` function.
 */
export class LlamaLangChain extends LLM {
  constructor(fields?: BaseLLMParams) {
    super(fields ?? {});
  }

  _llmType() {
    return "llama";
  }

  /**
   * The main entry point for the LLM. It takes a prompt and returns the
   * model's response.
   * @param prompt The user's prompt.
   * @param options Optional call options.
   * @returns The LLaMA model's string response.
   */
  async _call(prompt: string, options?: this["ParsedCallOptions"]): Promise<string> {
    // We are not passing any special options to callLlama for now.
    const response = await callLlama(prompt);
    return String(response); // Ensure the response is a string.
  }
} 