import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';

const sensitiveKeys = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
];

export function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (
      (obj as Record<string, unknown>)[key] &&
      typeof (obj as Record<string, unknown>)[key] === 'object'
    ) {
      sanitized[key] = sanitize((obj as Record<string, unknown>)[key]);
    } else {
      sanitized[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return sanitized;
}

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: sensitiveKeys.map((k) => `*.${k}`),
        censor: '[REDACTED]',
      },
      formatters: {
        level: (label) => ({ level: label }),
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    if (typeof sanitized === 'object' && sanitized !== null) {
      this.logger.info(sanitized);
    } else {
      this.logger.info({}, String(sanitized), ...optionalParams);
    }
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    if (typeof sanitized === 'object' && sanitized !== null) {
      this.logger.error(sanitized);
    } else {
      this.logger.error({}, String(sanitized), ...optionalParams);
    }
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    if (typeof sanitized === 'object' && sanitized !== null) {
      this.logger.warn(sanitized);
    } else {
      this.logger.warn({}, String(sanitized), ...optionalParams);
    }
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    if (typeof sanitized === 'object' && sanitized !== null) {
      this.logger.debug(sanitized);
    } else {
      this.logger.debug({}, String(sanitized), ...optionalParams);
    }
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    if (typeof sanitized === 'object' && sanitized !== null) {
      this.logger.trace(sanitized);
    } else {
      this.logger.trace({}, String(sanitized), ...optionalParams);
    }
  }

  child(bindings: Record<string, unknown>): pino.Logger {
    return this.logger.child(bindings);
  }
}

export const loggerFactory = () => ({
  pinoHttp: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: sensitiveKeys.map((k) => `*.${k}`),
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    customProps: () => ({
      context: 'HTTP',
    }),
  },
});
