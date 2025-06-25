import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { debugLog, errorLog, warnLog } from '@/utils/logger';

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
  groundingMetadata?: any; // Gemini grounding metadata
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface AIClient {
  createChatCompletion(params: {
    messages: Array<{ role: string; content: string | any[] }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
    enableGrounding?: boolean;
    tools?: Tool[];
    forceWebSearch?: boolean; // Force web search tool on first message
  }): Promise<AsyncIterable<StreamChunk> | string>;
}

class MockAIClient implements AIClient {
  async createChatCompletion(params: {
    messages: Array<{ role: string; content: string | any[] }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
    enableGrounding?: boolean;
    tools?: Tool[];
    forceWebSearch?: boolean;
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
  private provider?: string;
  
  constructor(provider?: string) {
    this.provider = provider;
  }
  
  async createChatCompletion(params: {
    messages: Array<{ role: string; content: string | any[] }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
    enableGrounding?: boolean;
    tools?: Tool[];
    forceWebSearch?: boolean;
  }): Promise<AsyncIterable<StreamChunk> | string> {
    // Configure API endpoint based on provider
    const clientConfig: any = {
      apiKey: params.apiKey || process.env.OPENAI_API_KEY,
    };
    
    // Use specific endpoints for different providers
    if (this.provider === "openrouter") {
      clientConfig.baseURL = "https://openrouter.ai/api/v1";
    } else if (this.provider === "xai") {
      clientConfig.baseURL = "https://api.x.ai/v1";
    }
    
    const client = new OpenAI(clientConfig);

    debugLog(`🔍 [${this.provider?.toUpperCase() || 'OPENAI'}-DEBUG] Creating completion with model: ${params.model || "gpt-3.5-turbo"}, stream: ${params.stream}, tools: ${params.tools ? 'enabled' : 'none'}`);
    
    const requestConfig: any = {
      model: params.model || "gpt-3.5-turbo",
      messages: params.messages as any,
      stream: params.stream || false,
      stream_options: params.stream ? { include_usage: true } : undefined,
    };

    // Add tools if provided
    if (params.tools && params.tools.length > 0) {
      requestConfig.tools = params.tools;
      
      // Force web search tool on first message if requested
      if (params.forceWebSearch) {
        const webSearchTool = params.tools.find(tool => tool.function.name === "web_search");
        if (webSearchTool) {
          requestConfig.tool_choice = {
            type: "function",
            function: { name: "web_search" }
          };
          debugLog(`🔧 [${this.provider?.toUpperCase() || 'OPENAI'}-DEBUG] Forcing web search tool on first message`);
        } else {
          requestConfig.tool_choice = "auto";
        }
      } else {
        requestConfig.tool_choice = "auto"; // Let the model decide when to use tools
      }
    }
    
    const completion = await client.chat.completions.create(requestConfig);
    
    debugLog(`🔍 [${this.provider?.toUpperCase() || 'OPENAI'}-DEBUG] Completion request sent successfully`);

    if (params.stream) {
      return this.createOpenAIStream(completion as any, this.provider);
    }

    return (completion as any).choices[0]?.message?.content || "";
  }

  private async *createOpenAIStream(stream: any, provider?: string): AsyncIterable<StreamChunk> {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let contentChunks = 0;
    let pendingToolCalls: any = {};
    let hasToolCalls = false;

    debugLog(`🔍 [${provider?.toUpperCase() || 'OPENAI'}-DEBUG] Starting stream processing...`);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      const usage = chunk.usage;
      const finishReason = chunk.choices[0]?.finish_reason;
      const toolCalls = chunk.choices[0]?.delta?.tool_calls;
      
      // Debug what we're actually getting (only log chunks with content or usage)
      if (contentChunks < 3 && (content || usage || toolCalls)) {
        debugLog(`🔍 [${provider?.toUpperCase() || 'OPENAI'}-DEBUG] Chunk ${contentChunks + 1} - Content: "${content}", ToolCalls: ${!!toolCalls}, Usage: ${JSON.stringify(usage)}, FinishReason: ${finishReason}`);
      }

      // Handle tool calls
      if (toolCalls) {
        hasToolCalls = true;
        for (const toolCall of toolCalls) {
          if (!pendingToolCalls[toolCall.index]) {
            pendingToolCalls[toolCall.index] = {
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function?.name || "",
                arguments: ""
              }
            };
          }
          
          // Accumulate function arguments
          if (toolCall.function?.arguments) {
            pendingToolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
          }
        }
      }

      // Track token usage when it comes in (usually at the end)
      if (usage) {
        inputTokens = usage.prompt_tokens || 0;
        outputTokens = usage.completion_tokens || 0;
        totalTokens = usage.total_tokens || 0;
        
        debugLog(`🔍 [${provider?.toUpperCase() || 'OPENAI'}-DEBUG] Usage chunk received - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`);
        
        // If we have tool calls and this is the final usage chunk, send them
        if (hasToolCalls && Object.keys(pendingToolCalls).length > 0) {
          const completedToolCalls = Object.values(pendingToolCalls) as ToolCall[];
          debugLog(`🔧 [${provider?.toUpperCase() || 'OPENAI'}-DEBUG] Tool calls completed: ${completedToolCalls.map(tc => tc.function.name).join(', ')}`);
          
          yield {
            content: "",
            toolCalls: completedToolCalls,
            tokenUsage: {
              inputTokens,
              outputTokens,
              totalTokens
            },
            isComplete: true
          };
          return; // End the stream here for tool calls
        }
        
        // Send a token update chunk for non-tool-call responses
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

      // Send tool calls when complete (backup check)
      if (finishReason === "tool_calls" && Object.keys(pendingToolCalls).length > 0) {
        const completedToolCalls = Object.values(pendingToolCalls) as ToolCall[];
        debugLog(`🔧 [${provider?.toUpperCase() || 'OPENAI'}-DEBUG] Tool calls completed via finish_reason: ${completedToolCalls.map(tc => tc.function.name).join(', ')}`);
        
        yield {
          content: "",
          toolCalls: completedToolCalls,
          tokenUsage: totalTokens > 0 ? {
            inputTokens,
            outputTokens,
            totalTokens
          } : undefined,
          isComplete: true
        };
      }

      // Final completion signal
      if (finishReason && finishReason !== "tool_calls" && !usage && !hasToolCalls) {
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
    messages: Array<{ role: string; content: string | any[] }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
    enableGrounding?: boolean;
    tools?: Tool[];
    forceWebSearch?: boolean;
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
    messages: Array<{ role: string; content: string | any[] }>;
    model?: string;
    stream?: boolean;
    apiKey?: string;
    enableGrounding?: boolean;
    tools?: Tool[];
    forceWebSearch?: boolean;
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

    // Check if this is a Gemini 2.0+ model that supports Google Search grounding
    const isGemini2Model = model.includes('gemini-2.0') || 
                          model.includes('gemini-2.5') || 
                          model.includes('gemini-2-0') || 
                          model.includes('gemini-2-5');
    
    // Prepare request body with optional Google Search grounding
    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    // Add Google Search grounding for Gemini 2.0+ models if enabled
    if (isGemini2Model && params.enableGrounding !== false) {
      requestBody.tools = [{
        googleSearch: {}
      }];
      console.log(`🔍 [GEMINI] Enabling Google Search grounding for ${model}`);
    } else if (isGemini2Model && params.enableGrounding === false) {
      console.log(`🚫 [GEMINI] Google Search grounding disabled for ${model}`);
    }

    // Rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - GeminiClient.lastRequestTime;
    if (timeSinceLastRequest < GeminiClient.MIN_REQUEST_INTERVAL) {
      const waitTime = GeminiClient.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      debugLog(`⏱️ [GEMINI] Rate limiting: waiting ${waitTime}ms before request`);
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
          body: JSON.stringify(requestBody),
        });

        if (response.status === 429) {
          // Rate limited - wait and retry
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          warnLog(`🔄 [GEMINI] Rate limited, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates[0]?.content?.parts[0]?.text || "";

        // Log grounding metadata if available
        if (data.candidates[0]?.groundingMetadata) {
          const groundingMetadata = data.candidates[0].groundingMetadata;
          debugLog(`🔍 [GEMINI] Response grounded with ${groundingMetadata.groundingChunks?.length || 0} sources`);
          
          if (groundingMetadata.searchEntryPoint?.renderedContent) {
            debugLog(`🔗 [GEMINI] Search suggestions available`);
          }
        }

    if (params.stream) {
          return this.createMockStream(content, data.candidates[0]?.groundingMetadata);
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
        warnLog(`⚠️ [GEMINI] Request failed, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries}): ${error}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All retries failed
    throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  private async *createMockStream(text: string, groundingMetadata?: any): AsyncIterable<StreamChunk> {
    const words = text.split(" ");
    let outputTokens = 0;

    for (let i = 0; i < words.length; i++) {
      const content = words[i] + " ";
      outputTokens++;
      const isLastChunk = i === words.length - 1;

      const chunk: StreamChunk = {
        content,
        // Only send token usage on the final chunk to avoid performance overhead
        tokenUsage: isLastChunk ? {
          inputTokens: 25, // Mock estimate
          outputTokens,
          totalTokens: 25 + outputTokens
        } : undefined,
        isComplete: isLastChunk
      };

      // Add grounding metadata to the final chunk if available
      if (isLastChunk && groundingMetadata) {
        (chunk as any).groundingMetadata = groundingMetadata;
      }

      yield chunk;

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
        return new OpenAIClient(provider);
      case "openai":
      default:
        return new OpenAIClient(provider);
    }
  }

  // Default to mock if no API key
  return new MockAIClient();
}; 