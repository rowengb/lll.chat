# Universal Web Search with Exa.AI

## Overview

This implementation adds universal web search capabilities to **all AI models** using Exa.AI, not just Gemini models with built-in grounding. This means you can now get current web information with OpenAI, Anthropic, DeepSeek, OpenRouter, and any other supported model.

**✅ Status: Fully implemented and working**

The system uses a hybrid architecture:

- **Streaming API** (edge runtime) for optimal performance
- **Dedicated search API** (Node.js runtime) for Exa.AI compatibility
- **Automatic fallback** if search fails

## How It Works

### Architecture

1. **Search Detection**: Analyzes user messages to determine if web search is needed
2. **Exa.AI Integration**: Performs real-time web search when appropriate
3. **Context Enhancement**: Injects search results into the conversation context
4. **Universal Compatibility**: Works with all models, not just Gemini
5. **Source Attribution**: Displays grounding sources in the UI for transparency

### Tool Calling Approach

Web search is now implemented using **AI tool calling**, allowing models to decide when and what to search for:

- **Smart Decisions**: AI determines when web search is needed based on the conversation
- **Multiple Searches**: AI can make multiple targeted searches in one response
- **Contextual Queries**: AI formulates specific search queries based on the conversation
- **Follow-up Searches**: AI can search for clarification when challenged or asked follow-up questions

### Examples

**Example 1: Current Events**

```
User: "Who's the US president?"
AI: [calls web_search("current US president 2025")]
AI: "Based on current information, Joe Biden is the US President..."

User: "No it's not"
AI: [calls web_search("US president January 2025 latest")]
AI: "Let me verify that with the most current information..."
```

**Example 2: Multiple Related Searches**

```
User: "What's happening with Tesla stock?"
AI: [calls web_search("Tesla stock price today")]
AI: [calls web_search("Tesla news recent developments")]
AI: "Here's the current Tesla stock information and recent news..."
```

**Example 3: Technical Information**

```
User: "Explain the latest developments in quantum computing"
AI: [calls web_search("quantum computing breakthroughs 2025")]
AI: "Recent developments in quantum computing include..."
```

## Technical Implementation

### Files Modified/Created

1. **`src/utils/webSearch.ts`** - Core web search functionality
2. **`src/utils/toolDefinitions.ts`** - Tool definitions for AI function calling
3. **`src/pages/api/web-search.ts`** - Dedicated search API route (Node.js runtime)
4. **`src/pages/api/chat/stream.ts`** - Streaming API with tool calling support (edge runtime)
5. **`src/server/ai/client.ts`** - Updated AI client with tool calling support
6. **Package.json** - Added `exa-js` dependency

### Architecture Details

- **Tool Calling**: AI models receive web search as an available tool/function
- **Edge Runtime Streaming**: `/api/chat/stream` runs in edge runtime for optimal performance
- **Node.js Search API**: `/api/web-search` runs in Node.js runtime for Exa.AI compatibility
- **Smart Execution**: AI decides when and what to search based on conversation context
- **Real-time Results**: Tool results are streamed back to the user immediately

### Key Functions

```typescript
// Perform web search and get formatted results
performWebSearch(query: string, numResults?: number)

// Determine if a message needs web search
shouldPerformWebSearch(message: string): boolean

// Create enhanced prompt with search context
createEnhancedPrompt(originalMessage: string, searchContext: string)
```

### Configuration

Set the Exa.AI API key as an environment variable:

```bash
EXA_API_KEY=your_exa_api_key_here
```

If not set, it falls back to the provided demo key.

## Usage

### For Users

1. Enable search grounding in the chat interface (search icon)
2. Ask questions that need current information
3. The system automatically searches when appropriate
4. View grounding sources below AI responses

### For Developers

The implementation is completely automatic:

- **Gemini 2.0+ models**: Continue using built-in Google Search grounding
- **All other models**: Automatically use Exa.AI web search when search grounding is enabled
- **Fallback**: If web search fails, continues without search results
- **Database**: Grounding sources are stored in the same format as Gemini results

## Model Compatibility

### Supported (with Exa.AI web search)

- ✅ OpenAI (GPT-4, GPT-3.5, etc.)
- ✅ Anthropic (Claude models)
- ✅ DeepSeek
- ✅ OpenRouter (any model)
- ✅ xAI (Grok)
- ✅ Any future models added

### Built-in Grounding (continues to work as before)

- ✅ Gemini 2.0+
- ✅ Gemini 2.5+

## Example Flow

1. User asks: "What's the latest news about SpaceX?"
2. AI receives the message and available tools (including `web_search`)
3. AI decides it needs current information and calls: `web_search("SpaceX news latest developments 2025")`
4. Tool executes Exa.AI search and returns formatted results:

   ```
   Search results for "SpaceX news latest developments 2025":

   [1] SpaceX launches record number of missions in 2025
   URL: https://spacenews.com/spacex-record-launches-2025
   Recent SpaceX achievements include...

   [2] Starship test flight successful
   URL: https://spacex.com/starship-update
   The latest Starship test shows...
   ```

5. AI incorporates search results into its response
6. User sees both the AI's response and the search results
7. If user asks follow-up like "What about their Mars plans?", AI can make another targeted search

## Benefits

- **Universal**: Works with ANY AI model
- **Current**: Always gets the latest information
- **Transparent**: Shows sources for verification
- **Automatic**: No manual intervention required
- **Compatible**: Maintains existing Gemini grounding
- **Performant**: Only searches when needed

## API Response Format

Web search results are returned in the same format as Gemini grounding:

```json
{
  "grounding": {
    "sources": [
      {
        "title": "Article Title",
        "url": "https://example.com/article",
        "snippet": "Article excerpt...",
        "confidence": 95,
        "unfurled": {
          "title": "Full Article Title",
          "description": "Article description",
          "finalUrl": "https://example.com/article",
          "siteName": "example.com"
        }
      }
    ]
  }
}
```

This ensures complete compatibility with the existing UI and database schema.
