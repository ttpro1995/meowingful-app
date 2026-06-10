import { RequestWithTenantContext } from '../tenant/tenant.request';

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordHash',
  'salt',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type JsonSafe =
  | string
  | number
  | boolean
  | null
  | JsonSafe[]
  | { [key: string]: JsonSafe };

function sanitizeUnknown(value: unknown): JsonSafe {
  if (value === null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry));
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const result: Record<string, JsonSafe> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      continue;
    }

    result[key] = sanitizeUnknown(entry);
  }

  return result;
}

export function createUpdateDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, JsonSafe> {
  const diff: Record<string, JsonSafe> = {
    before: sanitizeUnknown(before),
    after: sanitizeUnknown(after),
  };

  return diff;
}

export function getClientIpAddress(
  request?: RequestWithTenantContext,
): string | null {
  if (!request) {
    return null;
  }

  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? null;
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}
