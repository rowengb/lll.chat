// Examples of how to use the global logger system throughout the application
// This file can be deleted - it's just for reference

import { debugLog, errorLog, warnLog, forceLog, logger, isDebugEnabled } from './logger';

// === BASIC USAGE ===

// Debug logs (hidden in production by default)
debugLog('🚀 Starting API request...');
debugLog('📝 Processing data:', { userId: 123, model: 'gpt-4o' });

// Error logs (always shown unless explicitly disabled)
errorLog('❌ Failed to connect to database:', new Error('Connection timeout'));

// Warning logs (always shown unless explicitly disabled)  
warnLog('⚠️ Rate limit approaching, slowing down requests');

// Force logs (ALWAYS shown, even when all logging is disabled)
forceLog('🔥 CRITICAL: System maintenance starting in 5 minutes');

// === ADVANCED USAGE ===

// Conditional logging
if (isDebugEnabled()) {
  // Only run expensive debug operations when debug is enabled
  const debugData = { processed: true, count: 42 }; // Example expensive calculation
  debugLog('Debug calculation result:', debugData);
}

// Using the logger instance directly
logger.log('Same as debugLog');
logger.error('Same as errorLog');
logger.warn('Same as warnLog');
logger.force('Same as forceLog');

// Runtime configuration (useful for debugging)
logger.updateConfig({
  enableDebugLogs: true,  // Force enable debug logs
  enableErrorLogs: false, // Disable error logs
});

// Check current configuration
const config = logger.getConfig();
console.log('Current logger config:', config);

// === TYPICAL PATTERNS ===

// API Routes
export const apiExampleFunction = async () => {
  debugLog('🚀 [API] Starting request processing');
  
  try {
    // Your API logic here
    debugLog('📊 [API] Processing successful');
  } catch (error) {
    errorLog('❌ [API] Request failed:', error);
    throw error;
  }
};

// React Components  
export const ComponentExample = () => {
  const handleClick = () => {
    debugLog('🖱️ [UI] Button clicked');
    
    const someCondition = Math.random() > 0.5; // Example condition
    if (someCondition) {
      warnLog('⚠️ [UI] User action may have unexpected results');
    }
  };
  
  // Component JSX...
};

// Database Operations
export const databaseExample = async () => {
  debugLog('💾 [DB] Querying user data');
  
  try {
    // Example database operation
    const result = [{ id: 1, name: 'User' }]; // Simulated result
    debugLog('✅ [DB] Query successful, found', result.length, 'records');
    return result;
  } catch (error) {
    errorLog('💥 [DB] Database query failed:', error);
    throw new Error('Database operation failed');
  }
};

// === MIGRATION FROM console.log ===

// OLD:
// console.log('Debug info');           // Visible in production ❌
// console.error('Error occurred');     // Visible in production ❌  
// console.warn('Warning message');     // Visible in production ❌

// NEW:
// debugLog('Debug info');              // Hidden in production ✅
// errorLog('Error occurred');          // Shown but controllable ✅
// warnLog('Warning message');          // Shown but controllable ✅
// forceLog('Critical message');        // Always shown ✅ 