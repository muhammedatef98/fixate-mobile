/**
 * Production-safe logger utility
 * Replaces console.log with environment-aware logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeLocation: boolean;
}

class Logger {
  private config: LogConfig;
  private isDevelopment: boolean;

  constructor() {
    // Check if in development mode
    this.isDevelopment = __DEV__;

    this.config = {
      enabled: this.isDevelopment,
      level: this.isDevelopment ? 'debug' : 'error',
      includeTimestamp: true,
      includeLocation: this.isDevelopment,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Debug level logging (development only)
   */
  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      if (data !== undefined) {
        console.log(this.formatMessage('debug', message), data);
      } else {
        console.log(this.formatMessage('debug', message));
      }
    }
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      if (data !== undefined) {
        console.info(this.formatMessage('info', message), data);
      } else {
        console.info(this.formatMessage('info', message));
      }
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      if (data !== undefined) {
        console.warn(this.formatMessage('warn', message), data);
      } else {
        console.warn(this.formatMessage('warn', message));
      }
    }
  }

  /**
   * Error level logging (always enabled)
   */
  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      if (error !== undefined) {
        console.error(this.formatMessage('error', message), error);
      } else {
        console.error(this.formatMessage('error', message));
      }

      // In production, you could send errors to a service like Sentry
      if (!this.isDevelopment) {
        this.reportError(message, error);
      }
    }
  }

  /**
   * Report error to external service (placeholder)
   */
  private reportError(message: string, error?: any): void {
    // TODO: Implement error reporting service (Sentry, Firebase Crashlytics, etc.)
    // Example:
    // Sentry.captureException(error, { extra: { message } });
  }

  /**
   * Log API calls (useful for debugging)
   */
  api(method: string, url: string, data?: any): void {
    this.debug(`API ${method} ${url}`, data);
  }

  /**
   * Log navigation events
   */
  navigation(screen: string, params?: any): void {
    this.debug(`Navigation to ${screen}`, params);
  }

  /**
   * Log user actions
   */
  userAction(action: string, data?: any): void {
    this.info(`User action: ${action}`, data);
  }

  /**
   * Configure logger
   */
  configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default
export default logger;
