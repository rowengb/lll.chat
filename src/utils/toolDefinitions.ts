/**
 * Tool definitions for AI function calling
 * These tools allow AI models to perform web searches when they need current information
 */

export const webSearchTool = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "Search the web for current information. Use this when you need up-to-date information, facts, news, or verification of claims. Be specific in your search queries.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query. Be specific and use keywords that will find relevant information. Examples: 'current US president 2025', 'latest AI news', 'Tesla stock price today'"
        },
        context: {
          type: "string", 
          description: "Optional context about why you're searching. This helps provide better results."
        }
      },
      required: ["query"]
    }
  }
};

export const availableTools = [webSearchTool];

// Type definitions for tool calls
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface WebSearchArgs {
  query: string;
  context?: string;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
} 