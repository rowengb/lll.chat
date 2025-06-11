const OpenAI = require('openai');

// Mock implementation of our token tracking system
async function testTokenTracking() {
  console.log('🚀 [TOKEN-TEST] Testing token tracking system...');
  
  // This would normally come from environment variables
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
  });

  try {
    const startTime = Date.now();
    console.log('🤖 [TOKEN-TEST] Starting OpenAI streaming request...');

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Tell me a short joke about programming' }
      ],
      stream: true,
      stream_options: { include_usage: true }
    });

    let fullResponse = '';
    let chunkCount = 0;
    let tokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };

    console.log('⚡ [TOKEN-TEST] Stream started...');
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      const usage = chunk.usage;

      if (content) {
        chunkCount++;
        fullResponse += content;
        
        // Log first few chunks
        if (chunkCount <= 3) {
          console.log(`📦 [TOKEN-TEST] Chunk ${chunkCount}: "${content}" (${content.length} chars)`);
        }
      }

      // Track token usage from the stream
      if (usage) {
        tokenStats = {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        };
        
        const currentTime = Date.now();
        const elapsedSeconds = (currentTime - startTime) / 1000;
        const tokensPerSecond = tokenStats.outputTokens / elapsedSeconds;

        console.log(`🔢 [TOKEN-TEST] Token update - Input: ${tokenStats.inputTokens}, Output: ${tokenStats.outputTokens}, Total: ${tokenStats.totalTokens}`);
        console.log(`⚡ [TOKEN-TEST] Current TPS: ${tokensPerSecond.toFixed(2)} tokens/second`);
      }

      // Final chunk detection
      if (chunk.choices[0]?.finish_reason) {
        const totalTime = Date.now() - startTime;
        const finalTps = tokenStats.outputTokens / (totalTime / 1000);
        
        console.log(`✅ [TOKEN-TEST] Stream completed!`);
        console.log(`📊 [TOKEN-TEST] Final stats:`);
        console.log(`   - Total chunks: ${chunkCount}`);
        console.log(`   - Response length: ${fullResponse.length} characters`);
        console.log(`   - Input tokens: ${tokenStats.inputTokens}`);
        console.log(`   - Output tokens: ${tokenStats.outputTokens}`);
        console.log(`   - Total tokens: ${tokenStats.totalTokens}`);
        console.log(`   - Total time: ${totalTime}ms`);
        console.log(`🚀 [TOKEN-TEST] Final TPS: ${finalTps.toFixed(2)} tokens/second`);
        
        break;
      }
    }

  } catch (error) {
    console.error('❌ [TOKEN-TEST] Error:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('💡 [TOKEN-TEST] Note: This test requires a valid OpenAI API key.');
      console.log('   Set OPENAI_API_KEY environment variable to test with real API.');
      console.log('   The T3 app token tracking works the same way but includes database storage.');
    }
  }
}

// Also demo the mock client functionality
function demoMockTokens() {
  console.log('\n🎭 [MOCK-TEST] Demonstrating mock token tracking...');
  
  const mockResponse = "This is a mock response to test token tracking functionality.";
  const words = mockResponse.split(" ");
  let outputTokens = 0;
  
  words.forEach((word, i) => {
    outputTokens++;
    const tokenUsage = {
      inputTokens: 10,
      outputTokens,
      totalTokens: 10 + outputTokens
    };
    
    if (i < 3 || i === words.length - 1) {
      console.log(`📦 [MOCK-TEST] Chunk ${i + 1}: "${word}" - Tokens: ${tokenUsage.totalTokens} (${tokenUsage.outputTokens} output)`);
    }
  });
  
  console.log(`✅ [MOCK-TEST] Mock demo complete. Total output tokens: ${outputTokens}`);
}

if (require.main === module) {
  console.log('🎯 [TOKEN-TEST] Token Tracking Demonstration\n');
  
  demoMockTokens();
  
  if (process.env.OPENAI_API_KEY) {
    console.log('\n📡 [TOKEN-TEST] Real API key detected, testing with OpenAI...\n');
    testTokenTracking();
  } else {
    console.log('\n💡 [TOKEN-TEST] No API key found. Set OPENAI_API_KEY to test with real API.');
    console.log('   The mock demonstration above shows how token tracking works in the T3 app.');
  }
} 