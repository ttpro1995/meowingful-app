import { HttpException, HttpStatus } from '@nestjs/common';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { UserErrorDescriptor } from './user-error.type';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapStatusCodeToErrorCode(statusCode: number): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (statusCode === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (statusCode === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (statusCode === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (statusCode === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

function inferFieldFromMessage(message: string): string | undefined {
  const normalized = message.trim();
  if (!normalized) {
    return undefined;
  }

  const match = /^([a-zA-Z0-9_.[\]-]+)\s/.exec(normalized);
  if (!match?.[1]) {
    return undefined;
  }

  return `${match[1].charAt(0).toLowerCase()}${match[1].slice(1)}`;
}

function normalizeValidationMessages(messages: unknown): UserErrorDescriptor[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .flatMap((entry): UserErrorDescriptor[] => {
      if (typeof entry === 'string') {
        return [
          {
            code: 'VALIDATION_ERROR',
            message: entry,
            field: inferFieldFromMessage(entry),
          },
        ];
      }

      if (!isRecord(entry)) {
        return [];
      }

      const field =
        typeof entry.property === 'string' ? entry.property : undefined;
      const constraints = isRecord(entry.constraints)
        ? Object.values(entry.constraints).filter(
            (value): value is string => typeof value === 'string',
          )
        : [];

      return constraints.map((message) => ({
        code: 'VALIDATION_ERROR',
        message,
        field,
      }));
    })
    .filter((value) => value.message.length > 0);
}

function buildFormattedError(
  formattedError: GraphQLFormattedError,
  userErrors: UserErrorDescriptor[],
): GraphQLFormattedError {
  const firstError = userErrors[0] ?? {
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong',
  };

  const extensions: Record<string, unknown> = {
    code: firstError.code,
    errors: userErrors,
  };

  if (firstError.field) {
    extensions.field = firstError.field;
  }

  return {
    message: firstError.message,
    locations: formattedError.locations,
    path: formattedError.path,
    extensions,
  };
}

function mapHttpException(exception: HttpException): UserErrorDescriptor[] {
  const status = exception.getStatus();
  const response = exception.getResponse();
  const responseRecord = isRecord(response) ? response : undefined;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (status === HttpStatus.BAD_REQUEST) {
    const validationMessages = normalizeValidationMessages(
      responseRecord?.message,
    );

    if (validationMessages.length > 0) {
      return validationMessages;
    }

    return [
      {
        code: 'VALIDATION_ERROR',
        message:
          typeof exception.message === 'string'
            ? exception.message
            : 'Validation failed',
      },
    ];
  }

  return [
    {
      code: mapStatusCodeToErrorCode(status),
      message:
        typeof exception.message === 'string' &&
        exception.message.length > 0 &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        status !== HttpStatus.INTERNAL_SERVER_ERROR
          ? exception.message
          : 'Something went wrong',
    },
  ];
}

function mapSerializedHttpError(
  formattedError: GraphQLFormattedError,
): UserErrorDescriptor[] | null {
  const extensions = isRecord(formattedError.extensions)
    ? formattedError.extensions
    : null;

  if (!extensions) {
    return null;
  }

  if (extensions.code === 'GRAPHQL_VALIDATION_FAILED') {
    return [
      {
        code: 'VALIDATION_ERROR',
        message: formattedError.message,
      },
    ];
  }

  const originalError = isRecord(extensions.originalError)
    ? extensions.originalError
    : null;

  if (!originalError || typeof originalError.statusCode !== 'number') {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (originalError.statusCode === HttpStatus.BAD_REQUEST) {
    const validationMessages = normalizeValidationMessages(
      originalError.message,
    );

    if (validationMessages.length > 0) {
      return validationMessages;
    }
  }

  const code = mapStatusCodeToErrorCode(originalError.statusCode);
  return [
    {
      code,
      message:
        code === 'INTERNAL_ERROR'
          ? 'Something went wrong'
          : formattedError.message,
    },
  ];
}

export function formatGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const graphQLError = error instanceof GraphQLError ? error : undefined;

  if (graphQLError?.originalError instanceof HttpException) {
    const userErrors = mapHttpException(graphQLError.originalError);
    return buildFormattedError(formattedError, userErrors);
  }

  const serializedHttpErrors = mapSerializedHttpError(formattedError);
  if (serializedHttpErrors) {
    return buildFormattedError(formattedError, serializedHttpErrors);
  }

  if (process.env.NODE_ENV === 'production') {
    return buildFormattedError(formattedError, [
      {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    ]);
  }

  return buildFormattedError(formattedError, [
    {
      code: 'INTERNAL_ERROR',
      message: formattedError.message,
    },
  ]);
}
