import { createTRPCRouter } from "./trpc";
import { chatConvexRouter } from "./routers/chat-convex";
import { apiKeysConvexRouter } from "./routers/apiKeys-convex";
import { modelsConvexRouter } from "./routers/models-convex";
import { userPreferencesRouter } from "./routers/user-preferences";
import { filesRouter } from "./routers/files";

export const appRouter = createTRPCRouter({
  chat: chatConvexRouter,
  apiKeys: apiKeysConvexRouter,
  models: modelsConvexRouter,
  userPreferences: userPreferencesRouter,
  files: filesRouter,
});

export type AppRouter = typeof appRouter; 