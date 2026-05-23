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
    const msg =
      typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    this.logger.info({}, msg, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    const msg =
      typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    this.logger.error({}, msg, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    const msg =
      typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    this.logger.warn({}, msg, ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    const msg =
      typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    this.logger.debug({}, msg, ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    const sanitized = sanitize(message);
    const msg =
      typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    this.logger.trace({}, msg, ...optionalParams);
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
