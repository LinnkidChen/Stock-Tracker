import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  sentryLevel?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  sentryTags?: Record<string, string>;
  [key: string]: any;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    };

    if (process.env.NODE_ENV === 'development') {
      // Pretty print in dev
      // eslint-disable-next-line no-console
      console[level](
        `[${timestamp}] ${level.toUpperCase()}: ${message}`,
        context || ''
      );
    } else {
      // JSON in production
      // eslint-disable-next-line no-console
      console[level](JSON.stringify(logEntry));
    }

    // Sentry integration
    const { sentryLevel, sentryTags, ...sentryExtra } = context ?? {};

    if (level === 'error' && typeof Sentry.captureException === 'function') {
      Sentry.captureException(context?.error || new Error(message), {
        extra: sentryExtra,
        level: sentryLevel ?? 'error',
        tags: sentryTags
      });
    } else if (
      level === 'warn' &&
      typeof Sentry.captureMessage === 'function'
    ) {
      Sentry.captureMessage(message, {
        level: sentryLevel ?? 'warning',
        extra: sentryExtra,
        tags: sentryTags
      });
    }

    // Local file logging for errors/warnings in development
    if (
      process.env.NODE_ENV === 'development' &&
      (level === 'error' || level === 'warn')
    ) {
      const stack = context?.error?.stack || new Error().stack;

      if (typeof window === 'undefined') {
        // Server-side: Write directly
        // Dynamic import fs to avoid client-side build errors
        import('fs')
          .then((fs) => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('path');
            const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}
File/Line: ${stack ? stack.split('\n')[2]?.trim() : 'N/A'}
Context: ${JSON.stringify(context)}
Stack: ${stack}
----------------------------------------
`;
            const logFilePath = path.join(process.cwd(), 'error.log');
            fs.appendFileSync(logFilePath, logLine);
          })
          .catch((err) =>
            // eslint-disable-next-line no-console
            console.error('Failed to write log', err)
          );
      } else {
        // Client-side: Send to API
        fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp,
            level,
            message,
            stack,
            ...context
          })
        }).catch((e) =>
          // eslint-disable-next-line no-console
          console.error('Failed to send log to server', e)
        );
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
