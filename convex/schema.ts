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
    createdAt: v.optional(v.number()), // Timestamp when user signed up in Clerk
    // User preferences
    defaultModel: v.optional(v.string()), // User's preferred default model ID
    titleGenerationModel: v.optional(v.string()), // User's preferred model for generating chat titles
    useOpenRouter: v.optional(v.boolean()), // Whether user prefers OpenRouter mode
    // Subscription fields
    isPaidUser: v.optional(v.boolean()), // Whether user has active paid subscription
    subDate: v.optional(v.number()), // Subscription start date (timestamp)
    subEndDate: v.optional(v.number()), // Subscription end date (timestamp)
    subStatus: v.optional(v.string()), // Subscription status: "active", "canceled", "expired", "trialing"
    subPlan: v.optional(v.string()), // Subscription plan: "monthly", "yearly", "lifetime"
    stripeCustomerId: v.optional(v.string()), // Stripe customer ID
    stripeSubscriptionId: v.optional(v.string()), // Stripe subscription ID
  }).index("by_email", ["email"]).index("by_auth_id", ["authId"]).index("by_paid_status", ["isPaidUser"]),

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
    attachments: v.optional(v.array(v.id("files"))), // Array of file IDs
    isGrounded: v.optional(v.boolean()), // Indicates if response was grounded with search
    searchProvider: v.optional(v.string()), // Search provider: "exa", "google", etc.
    groundingSources: v.optional(v.array(v.object({
      title: v.string(), // Domain name (e.g., "pbs.org", "democracynow.org")
      url: v.string(), // Vertexaisearch redirect URL
      snippet: v.optional(v.string()),
      confidence: v.optional(v.number()), // Confidence percentage (0-100)
      // Unfurled metadata from the actual destination
      unfurledTitle: v.optional(v.string()), // Actual article title
      unfurledDescription: v.optional(v.string()), // Article description
      unfurledImage: v.optional(v.string()), // Article image
      unfurledFavicon: v.optional(v.string()), // Site favicon
      unfurledSiteName: v.optional(v.string()), // Site name
      unfurledFinalUrl: v.optional(v.string()), // Final URL after redirects
      unfurledAt: v.optional(v.number()), // Timestamp when unfurled
    }))),
    // Image generation fields
    imageUrl: v.optional(v.string()), // Generated image URL (temporary, will be replaced by imageFileId)
    imageFileId: v.optional(v.id("files")), // Stored image file ID in Convex
    imageData: v.optional(v.string()), // Base64 encoded image data
    stoppedByUser: v.optional(v.boolean()), // Flag to indicate if stream was stopped by user
    isError: v.optional(v.boolean()), // Flag to indicate if this is an error message
    rawErrorData: v.optional(v.any()), // Raw error data for debugging
  }).index("by_thread", ["threadId"]).index("by_user", ["userId"]),

  files: defineTable({
    name: v.string(), // Original filename
    type: v.string(), // MIME type
    size: v.number(), // File size in bytes
    storageId: v.id("_storage"), // Convex file storage ID
    userId: v.id("users"), // Owner of the file
    messageId: v.optional(v.id("messages")), // Associated message
    threadId: v.optional(v.id("threads")), // Associated thread
  }).index("by_user", ["userId"])
    .index("by_message", ["messageId"])
    .index("by_thread", ["threadId"]),

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
    openrouterModelId: v.optional(v.string()), // OpenRouter-specific model ID (e.g., "google/gemini-2.5-pro-preview")
    capabilities: v.array(v.string()), // Array of capabilities (e.g., ["vision", "reasoning", "experimental"])
    isFavorite: v.boolean(), // Whether it's in the default favorites section (for new users)
    isActive: v.boolean(), // Whether the model is available
    order: v.number(), // Sort order for display
    contextWindow: v.optional(v.number()), // Context window size
    maxTokens: v.optional(v.number()), // Max output tokens
    costPer1kTokens: v.optional(v.number()), // Cost per 1k tokens for estimation
  }).index("by_provider", ["provider"])
    .index("by_active", ["isActive"])
    .index("by_favorite", ["isFavorite"])
    .index("by_order", ["order"]),

  userModelFavorites: defineTable({
    userId: v.id("users"),
    modelId: v.string(), // Reference to models.id field
  }).index("by_user", ["userId"])
    .index("by_user_model", ["userId", "modelId"]),
}); 