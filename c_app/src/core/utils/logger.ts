type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  tag: string;
  enabled?: boolean;
}

function formatMessage(tag: string, message: string): string {
  return `[${tag}] ${message}`;
}

export function createLogger(tag: string, enabled = __DEV__): {
  debug: (message: string, extra?: unknown) => void;
  info: (message: string, extra?: unknown) => void;
  warn: (message: string, extra?: unknown) => void;
  error: (message: string, extra?: unknown) => void;
} {
  const log = (level: LogLevel, message: string, extra?: unknown) => {
    if (!enabled) {
      return;
    }
    const formatted = formatMessage(tag, message);
    switch (level) {
      case 'debug':
        console.debug(formatted, extra ?? '');
        break;
      case 'info':
        console.info(formatted, extra ?? '');
        break;
      case 'warn':
        console.warn(formatted, extra ?? '');
        break;
      case 'error':
        console.error(formatted, extra ?? '');
        break;
      default:
        console.log(formatted, extra ?? '');
    }
  };

  return {
    debug: (message, extra) => log('debug', message, extra),
    info: (message, extra) => log('info', message, extra),
    warn: (message, extra) => log('warn', message, extra),
    error: (message, extra) => log('error', message, extra),
  };
}

export const appLogger = createLogger('Drishti');