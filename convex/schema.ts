import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
    // NextAuth fields
    authId: v.string(), // Maps to NextAuth user.id
    // User preferences
    defaultModel: v.optional(v.string()), // User's preferred default model ID
  }).index("by_email", ["email"]).index("by_auth_id", ["authId"]),

  threads: defineTable({
    title: v.optional(v.string()),
    userId: v.id("users"),
    lastModel: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    pinned: v.boolean(),
    branchedFromThreadId: v.optional(v.id("threads")), // Track which thread this was branched from
  }).index("by_user", ["userId"]),

  messages: defineTable({
    content: v.string(),
    role: v.string(),
    model: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
  }).index("by_thread", ["threadId"]).index("by_user", ["userId"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    keyValue: v.string(), // Encrypted API key
  }).index("by_user", ["userId"]).index("by_user_provider", ["userId", "provider"]),

  models: defineTable({
    id: v.string(), // Model identifier (e.g., "gpt-4o")
    name: v.string(), // Display name (e.g., "GPT-4o")
    displayNameTop: v.optional(v.string()), // Top line for display (e.g., "Gemini")
    displayNameBottom: v.optional(v.string()), // Bottom line for display (e.g., "2.5 Flash")
    description: v.string(), // Short description
    subtitle: v.optional(v.string()), // Optional subtitle (e.g., "(Reasoning)", "(Thinking)")
    provider: v.string(), // Provider name (e.g., "openai", "anthropic")
    apiUrl: v.optional(v.string()), // API endpoint URL
    capabilities: v.array(v.string()), // Array of capabilities (e.g., ["vision", "reasoning", "experimental"])
    isFavorite: v.boolean(), // Whether it's in the favorites section
    isActive: v.boolean(), // Whether the model is available
    order: v.number(), // Sort order for display
    contextWindow: v.optional(v.number()), // Context window size
    maxTokens: v.optional(v.number()), // Max output tokens
    costPer1kTokens: v.optional(v.number()), // Cost per 1k tokens for estimation
  }).index("by_provider", ["provider"])
    .index("by_active", ["isActive"])
    .index("by_favorite", ["isFavorite"])
    .index("by_order", ["order"]),
}); 