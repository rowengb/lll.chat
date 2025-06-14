import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    role: v.string(),
    model: v.optional(v.string()),
    userId: v.id("users"),
    isGrounded: v.optional(v.boolean()),
    groundingSources: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      snippet: v.optional(v.string()),
      confidence: v.optional(v.number()),
    }))),
    attachments: v.optional(v.array(v.id("files"))),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      content: args.content,
      role: args.role,
      model: args.model,
      userId: args.userId,
      isGrounded: args.isGrounded,
      groundingSources: args.groundingSources,
      attachments: args.attachments,
    });
    
    return messageId;
  },
});

export const getByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

export const createMany = mutation({
  args: {
    messages: v.array(v.object({
      content: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
      threadId: v.id("threads"),
      userId: v.id("users"),
      attachments: v.optional(v.array(v.id("files"))),
      isGrounded: v.optional(v.boolean()),
      groundingSources: v.optional(v.array(v.object({
        title: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
        confidence: v.optional(v.number()),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const message of args.messages) {
      const result = await ctx.db.insert("messages", message);
      results.push(result);
    }
    return results;
  },
});

export const createAssistantMessage = mutation({
  args: {
    content: v.string(),
    model: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
    attachments: v.optional(v.array(v.id("files"))),
    isGrounded: v.optional(v.boolean()),
    groundingSources: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      snippet: v.optional(v.string()),
      confidence: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      content: args.content,
      role: "assistant",
      model: args.model,
      threadId: args.threadId,
      userId: args.userId,
      attachments: args.attachments,
      isGrounded: args.isGrounded,
      groundingSources: args.groundingSources,
    });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    // Get the message to check for attachments
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    
    // Delete associated files if any
    if (message.attachments && message.attachments.length > 0) {
      for (const fileId of message.attachments) {
        const file = await ctx.db.get(fileId);
        if (file) {
          // Delete from storage
          await ctx.storage.delete(file.storageId);
          // Delete from database
          await ctx.db.delete(fileId);
        }
      }
    }
    
    // Delete the message
    return await ctx.db.delete(args.messageId);
  },
});

// Delete multiple messages from a certain point in a thread
export const deleteMessagesFromPoint = mutation({
  args: { 
    threadId: v.id("threads"), 
    fromMessageId: v.id("messages") 
  },
  handler: async (ctx, args) => {
    // Get all messages in the thread ordered by creation time
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
    
    // Find the index of the fromMessageId
    const fromIndex = messages.findIndex(msg => msg._id === args.fromMessageId);
    if (fromIndex === -1) return { deletedCount: 0 };
    
    // Delete all messages from that point forward
    const messagesToDelete = messages.slice(fromIndex);
    for (const message of messagesToDelete) {
      // Delete associated files if any
      if (message.attachments && message.attachments.length > 0) {
        for (const fileId of message.attachments) {
          const file = await ctx.db.get(fileId);
          if (file) {
            // Delete from storage
            await ctx.storage.delete(file.storageId);
            // Delete from database
            await ctx.db.delete(fileId);
          }
        }
      }
      
      // Delete the message
      await ctx.db.delete(message._id);
    }
    
    return { deletedCount: messagesToDelete.length };
  },
});

export const updateGroundingSourceUnfurl = mutation({
  args: {
    messageId: v.id("messages"),
    sourceIndex: v.number(),
    userId: v.id("users"), // Accept userId directly from TRPC
    unfurledData: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      favicon: v.optional(v.string()),
      siteName: v.optional(v.string()),
      finalUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { messageId, sourceIndex, userId, unfurledData } = args;
    
    // Get the message
    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    // Check if user owns this message
    if (message.userId !== userId) {
      throw new Error("Not authorized");
    }
    
    // Update the grounding source with unfurled data
    if (message.groundingSources && message.groundingSources[sourceIndex]) {
      const updatedSources = [...message.groundingSources];
      updatedSources[sourceIndex] = {
        ...updatedSources[sourceIndex],
        unfurledTitle: unfurledData.title,
        unfurledDescription: unfurledData.description,
        unfurledImage: unfurledData.image,
        unfurledFavicon: unfurledData.favicon,
        unfurledSiteName: unfurledData.siteName,
        unfurledFinalUrl: unfurledData.finalUrl,
        unfurledAt: Date.now(),
      };
      
      await ctx.db.patch(messageId, {
        groundingSources: updatedSources,
      });
      
      return { success: true };
    }
    
    return { success: false, error: "Source not found" };
  },
});

// Migration function to clean up old grounding fields from existing messages
export const cleanupOldGroundingFields = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🧹 Starting cleanup of old grounding fields...");
    
    // Get all messages that have the old fields
    const allMessages = await ctx.db.query("messages").collect();
    
    let updatedCount = 0;
    
    for (const message of allMessages) {
      // Check if the message has the old fields (using any type to access them)
      const messageAny = message as any;
      
      if (messageAny.groundingSearchQueries || messageAny.groundedSegments) {
        console.log(`🧹 Cleaning message ${message._id}...`);
        
        // Create a clean version without the old fields
        const cleanMessage: any = { ...message };
        delete cleanMessage.groundingSearchQueries;
        delete cleanMessage.groundedSegments;
        
        // Remove the fields we don't want to update
        delete cleanMessage._id;
        delete cleanMessage._creationTime;
        
        // Update the message
        await ctx.db.patch(message._id, cleanMessage);
        updatedCount++;
      }
    }
    
    console.log(`🧹 Cleanup complete! Updated ${updatedCount} messages.`);
    return { 
      success: true, 
      totalMessages: allMessages.length,
      updatedMessages: updatedCount 
    };
  },
});

// Migration function to clean up actualUrl fields from grounding sources
export const cleanupActualUrlFields = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🧹 Starting cleanup of actualUrl fields from grounding sources...");
    
    // Get all messages that have grounding sources
    const allMessages = await ctx.db.query("messages").collect();
    
    let updatedCount = 0;
    
    for (const message of allMessages) {
      if (message.groundingSources && message.groundingSources.length > 0) {
        // Check if any source has actualUrl field
        const hasActualUrl = message.groundingSources.some((source: any) => source.actualUrl);
        
        if (hasActualUrl) {
          console.log(`🧹 Cleaning grounding sources in message ${message._id}...`);
          
          // Clean up the grounding sources
          const cleanedSources = message.groundingSources.map((source: any) => {
            const cleanSource = { ...source };
            delete cleanSource.actualUrl;
            return cleanSource;
          });
          
          // Update the message
          await ctx.db.patch(message._id, {
            groundingSources: cleanedSources
          });
          updatedCount++;
        }
      }
    }
    
    console.log(`🧹 Cleanup complete! Updated ${updatedCount} messages.`);
    return { 
      success: true, 
      totalMessages: allMessages.length,
      updatedMessages: updatedCount 
    };
  },
});

// Comprehensive cleanup function to forcefully remove ALL deprecated fields
export const forceCleanupAllDeprecatedFields = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🧹 Starting FORCE cleanup of ALL deprecated fields...");
    
    // Get all messages
    const allMessages = await ctx.db.query("messages").collect();
    
    let updatedCount = 0;
    
    for (const message of allMessages) {
      const messageAny = message as any;
      let needsUpdate = false;
      
      // Check for any deprecated fields
      if (messageAny.groundingSearchQueries !== undefined || 
          messageAny.groundedSegments !== undefined ||
          (messageAny.groundingSources && messageAny.groundingSources.some((s: any) => s.actualUrl !== undefined))) {
        
        console.log(`🧹 FORCE cleaning message ${message._id}...`);
        needsUpdate = true;
        
        // Build a completely clean message object with only valid fields
        const cleanMessage: any = {
          content: message.content,
          role: message.role,
          threadId: message.threadId,
          userId: message.userId,
        };
        
        // Add optional fields if they exist and are valid
        if (message.model) cleanMessage.model = message.model;
        if (message.attachments) cleanMessage.attachments = message.attachments;
        if (message.isGrounded !== undefined) cleanMessage.isGrounded = message.isGrounded;
        
        // Clean grounding sources if they exist
        if (message.groundingSources && message.groundingSources.length > 0) {
          cleanMessage.groundingSources = message.groundingSources.map((source: any) => {
            const cleanSource: any = {
              title: source.title,
              url: source.url,
            };
            
            // Add optional fields if they exist
            if (source.snippet !== undefined) cleanSource.snippet = source.snippet;
            if (source.confidence !== undefined) cleanSource.confidence = source.confidence;
            if (source.unfurledTitle !== undefined) cleanSource.unfurledTitle = source.unfurledTitle;
            if (source.unfurledDescription !== undefined) cleanSource.unfurledDescription = source.unfurledDescription;
            if (source.unfurledImage !== undefined) cleanSource.unfurledImage = source.unfurledImage;
            if (source.unfurledFavicon !== undefined) cleanSource.unfurledFavicon = source.unfurledFavicon;
            if (source.unfurledSiteName !== undefined) cleanSource.unfurledSiteName = source.unfurledSiteName;
            if (source.unfurledFinalUrl !== undefined) cleanSource.unfurledFinalUrl = source.unfurledFinalUrl;
            if (source.unfurledAt !== undefined) cleanSource.unfurledAt = source.unfurledAt;
            
            return cleanSource;
          });
        }
        
        // Replace the entire message with the clean version
        await ctx.db.replace(message._id, cleanMessage);
        updatedCount++;
      }
    }
    
    console.log(`🧹 FORCE cleanup complete! Updated ${updatedCount} messages.`);
    return { 
      success: true, 
      totalMessages: allMessages.length,
      updatedMessages: updatedCount 
    };
  },
});

// NUCLEAR cleanup function - DELETE and recreate problematic messages
export const nuclearCleanupDeprecatedFields = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("💥 Starting NUCLEAR cleanup - DELETE and recreate problematic messages...");
    
    // Get all messages
    const allMessages = await ctx.db.query("messages").collect();
    
    let deletedCount = 0;
    let recreatedCount = 0;
    
    for (const message of allMessages) {
      const messageAny = message as any;
      
      // Check for any deprecated fields
      if (messageAny.groundingSearchQueries !== undefined || 
          messageAny.groundedSegments !== undefined ||
          (messageAny.groundingSources && messageAny.groundingSources.some((s: any) => s.actualUrl !== undefined))) {
        
        console.log(`💥 DELETING and recreating message ${message._id}...`);
        
        // Build a completely clean message object with only valid fields
        const cleanMessage: any = {
          content: message.content,
          role: message.role,
          threadId: message.threadId,
          userId: message.userId,
        };
        
        // Add optional fields if they exist and are valid
        if (message.model) cleanMessage.model = message.model;
        if (message.attachments) cleanMessage.attachments = message.attachments;
        if (message.isGrounded !== undefined) cleanMessage.isGrounded = message.isGrounded;
        
        // Clean grounding sources if they exist
        if (message.groundingSources && message.groundingSources.length > 0) {
          cleanMessage.groundingSources = message.groundingSources.map((source: any) => {
            const cleanSource: any = {
              title: source.title,
              url: source.url,
            };
            
            // Add optional fields if they exist
            if (source.snippet !== undefined) cleanSource.snippet = source.snippet;
            if (source.confidence !== undefined) cleanSource.confidence = source.confidence;
            if (source.unfurledTitle !== undefined) cleanSource.unfurledTitle = source.unfurledTitle;
            if (source.unfurledDescription !== undefined) cleanSource.unfurledDescription = source.unfurledDescription;
            if (source.unfurledImage !== undefined) cleanSource.unfurledImage = source.unfurledImage;
            if (source.unfurledFavicon !== undefined) cleanSource.unfurledFavicon = source.unfurledFavicon;
            if (source.unfurledSiteName !== undefined) cleanSource.unfurledSiteName = source.unfurledSiteName;
            if (source.unfurledFinalUrl !== undefined) cleanSource.unfurledFinalUrl = source.unfurledFinalUrl;
            if (source.unfurledAt !== undefined) cleanSource.unfurledAt = source.unfurledAt;
            
            return cleanSource;
          });
        }
        
        // DELETE the old message completely
        await ctx.db.delete(message._id);
        deletedCount++;
        
        // INSERT a new clean message
        await ctx.db.insert("messages", cleanMessage);
        recreatedCount++;
      }
    }
    
    console.log(`💥 NUCLEAR cleanup complete! Deleted ${deletedCount} messages, recreated ${recreatedCount} messages.`);
    return { 
      success: true, 
      totalMessages: allMessages.length,
      deletedMessages: deletedCount,
      recreatedMessages: recreatedCount
    };
  },
}); 