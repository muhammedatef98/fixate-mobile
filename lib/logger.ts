/**
 * Logger utility for consistent logging across the app
 * Provides different log levels and can be configured for production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enabledInProduction: boolean;
  minLevel: LogLevel;
}

const config: LogConfig = {
  enabledInProduction: false,
  minLevel: __DEV__ ? 'debug' : 'error',
};

const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (!__DEV__ && !config.enabledInProduction) {
      return level === 'error';
    }
    return logLevels[level] >= logLevels[config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return data ? `${prefix} ${message}` : `${prefix} ${message}`;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data), data || '');
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data), data || '');
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data), data || '');
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, error), error || '');
      
      // In production, you could send errors to a service like Sentry
      if (!__DEV__) {
        // TODO: Send to error tracking service
        // Sentry.captureException(error);
      }
    }
  }

  // Specialized logging methods
  api(method: string, endpoint: string, data?: any) {
    this.debug(`API ${method} ${endpoint}`, data);
  }

  navigation(screen: string, params?: any) {
    this.debug(`Navigation to ${screen}`, params);
  }

  auth(action: string, data?: any) {
    this.info(`Auth: ${action}`, data);
  }

  database(action: string, table: string, data?: any) {
    this.debug(`Database ${action} on ${table}`, data);
  }
}

export const logger = new Logger();

// Export for configuration if needed
export const configureLogger = (newConfig: Partial<LogConfig>) => {
  Object.assign(config, newConfig);
};
