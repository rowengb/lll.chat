// Cache debugging utility for development
export const cacheDebug = {
  logCacheState: (label: string, data: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [CACHE] ${label}:`, {
        timestamp: new Date().toISOString(),
        dataCount: Array.isArray(data) ? data.length : 'not-array',
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null,
        data: data
      });
    }
  },
  
  logMutation: (mutationType: string, variables: any, result: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [MUTATION] ${mutationType}:`, {
        timestamp: new Date().toISOString(),
        variables,
        result
      });
    }
  },
  
  logCacheInvalidation: (queryKey: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`♻️ [CACHE-INVALIDATE] ${queryKey}:`, {
        timestamp: new Date().toISOString()
      });
    }
  }
}; 