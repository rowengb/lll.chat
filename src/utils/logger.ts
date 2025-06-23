// Global logger utility with production disable capability

interface LoggerConfig {
  enableDebugLogs: boolean;
  enableErrorLogs: boolean;
  enableWarnLogs: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = {
      // Disable debug logs in production, but allow errors/warnings
      enableDebugLogs: process.env.DISABLE_DEBUG_LOGS !== 'true' && process.env.NODE_ENV !== 'production',
      enableErrorLogs: process.env.DISABLE_ERROR_LOGS !== 'true',
      enableWarnLogs: process.env.DISABLE_WARN_LOGS !== 'true',
    };
  }

  // Debug logs (disabled in production by default)
  log(...args: any[]) {
    if (this.config.enableDebugLogs) {
      console.log(...args);
    }
  }

  // Info logs (same as debug for now)
  info(...args: any[]) {
    if (this.config.enableDebugLogs) {
      console.info(...args);
    }
  }

  // Warning logs (enabled by default, can be disabled)
  warn(...args: any[]) {
    if (this.config.enableWarnLogs) {
      console.warn(...args);
    }
  }

  // Error logs (enabled by default, can be disabled)
  error(...args: any[]) {
    if (this.config.enableErrorLogs) {
      console.error(...args);
    }
  }

  // Force logs that always show (for critical messages)
  force(...args: any[]) {
    console.log(...args);
  }

  // Method to update config at runtime (useful for debugging)
  updateConfig(newConfig: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current config
  getConfig() {
    return { ...this.config };
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports for common patterns
export const debugLog = logger.log.bind(logger);
export const infoLog = logger.info.bind(logger);
export const warnLog = logger.warn.bind(logger);
export const errorLog = logger.error.bind(logger);
export const forceLog = logger.force.bind(logger);

// Helper to check if debug logging is enabled
export const isDebugEnabled = () => logger.getConfig().enableDebugLogs; 