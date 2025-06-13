import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  content: string;
  tokenUsage?: TokenUsage;
  isComplete?: boolean;
}

export interface AIClient {
  createChatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
  }): Promise<AsyncIterable<StreamChunk> | string>;
}

class MockAIClient implements AIClient {
  async createChatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
  }): Promise<AsyncIterable<StreamChunk> | string> {
    const lastMessage = params.messages[params.messages.length - 1];
    const response = `Mock response to: "${lastMessage?.content}" (using ${params.model || 'mock-model'})`;
    
    if (params.stream) {
      return this.createMockStream(response);
    }
    
    return response;
  }

  private async *createMockStream(text: string): AsyncIterable<StreamChunk> {
    const words = text.split(" ");
    let outputTokens = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i] + " ";
      outputTokens++;

      yield {
        content: word,
        tokenUsage: {
          inputTokens: 10, // Mock input tokens
          outputTokens,
          totalTokens: 10 + outputTokens
        },
        isComplete: i === words.length - 1
      };

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

class OpenAIClient implements AIClient {
  async createChatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
  }): Promise<AsyncIterable<StreamChunk> | string> {
    const client = new OpenAI({
      apiKey: params.apiKey || process.env.OPENAI_API_KEY,
    });

    console.log(`🔍 [OPENAI-DEBUG] Creating completion with model: ${params.model || "gpt-3.5-turbo"}, stream: ${params.stream}`);
    
    const completion = await client.chat.completions.create({
      model: params.model || "gpt-3.5-turbo",
      messages: params.messages as any,
      stream: params.stream || false,
      stream_options: params.stream ? { include_usage: true } : undefined,
    });
    
    console.log(`🔍 [OPENAI-DEBUG] Completion request sent successfully`);

    if (params.stream) {
      return this.createOpenAIStream(completion as any);
    }

    return (completion as any).choices[0]?.message?.content || "";
  }

  private async *createOpenAIStream(stream: any): AsyncIterable<StreamChunk> {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let contentChunks = 0;

    console.log(`🔍 [OPENAI-DEBUG] Starting stream processing...`);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      const usage = chunk.usage;
      const finishReason = chunk.choices[0]?.finish_reason;
      
      // Debug what we're actually getting
      if (contentChunks < 3) {
        console.log(`🔍 [OPENAI-DEBUG] Chunk ${contentChunks + 1} - Content: "${content}", Usage: ${JSON.stringify(usage)}, FinishReason: ${finishReason}`);
      }

      // Track token usage when it comes in (usually at the end)
      if (usage) {
        inputTokens = usage.prompt_tokens || 0;
        outputTokens = usage.completion_tokens || 0;
        totalTokens = usage.total_tokens || 0;
        
        console.log(`🔍 [OPENAI-DEBUG] Usage chunk received - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`);
        
        // Send a token update chunk
        yield {
          content: "",
          tokenUsage: {
            inputTokens,
            outputTokens,
            totalTokens
          },
          isComplete: !!finishReason
        };
      }

      // Send content chunks (minimal overhead)
      if (content) {
        contentChunks++;
        yield {
          content,
          // Skip token calculations during streaming for performance
          tokenUsage: totalTokens > 0 ? {
            inputTokens,
            outputTokens,
            totalTokens
          } : undefined,
          isComplete: false
        };
      }

      // Final completion signal
      if (finishReason && !usage) {
        yield {
          content: "",
          tokenUsage: totalTokens > 0 ? {
            inputTokens,
            outputTokens,
            totalTokens
          } : undefined,
          isComplete: true
        };
      }
    }
  }
}

class AnthropicClient implements AIClient {
  async createChatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
  }): Promise<AsyncIterable<StreamChunk> | string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model || "claude-3-sonnet-20240229",
        max_tokens: 4096,
        messages: params.messages.filter(m => m.role !== "system"),
        system: params.messages.find(m => m.role === "system")?.content,
        stream: params.stream || false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    if (params.stream) {
      return this.createAnthropicStream(response);
    }

    const data = await response.json();
    return data.content[0]?.text || "";
  }

  private async *createAnthropicStream(response: Response): AsyncIterable<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta") {
                const content = parsed.delta?.text || "";
                if (content) {
                  outputTokens += Math.ceil(content.length / 4); // Rough token estimate
                  yield {
                    content,
                    tokenUsage: {
                      inputTokens: 50, // Estimate
                      outputTokens,
                      totalTokens: 50 + outputTokens
                    },
                    isComplete: false
                  };
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

class GeminiClient implements AIClient {
  private static lastRequestTime = 0;
  private static readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

  async createChatCompletion(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
  }): Promise<AsyncIterable<StreamChunk> | string> {
    const model = params.model || "gemini-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`;

    // Convert messages to Gemini format
    const contents = params.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // Rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - GeminiClient.lastRequestTime;
    if (timeSinceLastRequest < GeminiClient.MIN_REQUEST_INTERVAL) {
      const waitTime = GeminiClient.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏱️ [GEMINI] Rate limiting: waiting ${waitTime}ms before request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    GeminiClient.lastRequestTime = Date.now();

    // Retry logic for rate limiting
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (response.status === 429) {
          // Rate limited - wait and retry
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`🔄 [GEMINI] Rate limited, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.candidates[0]?.content?.parts[0]?.text || "";

        if (params.stream) {
          return this.createMockStream(content);
        }

        return content;
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxRetries - 1) {
          // Last attempt failed
          break;
        }
        
        // Wait before retrying
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`⚠️ [GEMINI] Request failed, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries}): ${error}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All retries failed
    throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  private async *createMockStream(text: string): AsyncIterable<StreamChunk> {
    const words = text.split(" ");
    let outputTokens = 0;

    for (let i = 0; i < words.length; i++) {
      const content = words[i] + " ";
      outputTokens++;

      yield {
        content,
        tokenUsage: {
          inputTokens: 25, // Mock estimate
          outputTokens,
          totalTokens: 25 + outputTokens
        },
        isComplete: i === words.length - 1
      };

      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

export const getAiClient = (provider?: string, apiKey?: string): AIClient => {
  // If no API key is provided and AI_MODE is mock, use mock client
  if (!apiKey && process.env.AI_MODE === "mock") {
    return new MockAIClient();
  }

  // If API key is provided, always use real client for that provider
  if (apiKey) {
    switch (provider) {
      case "anthropic":
        return new AnthropicClient();
      case "gemini":
        return new GeminiClient();
      case "deepseek":
      case "together":
      case "fireworks":
      case "openrouter":
      case "xai":
      case "alibaba":
        // These providers use OpenAI-compatible APIs
        return new OpenAIClient();
      case "openai":
      default:
        return new OpenAIClient();
    }
  }

  // Default to mock if no API key
  return new MockAIClient();
}; 