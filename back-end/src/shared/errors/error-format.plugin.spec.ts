import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { formatGraphQLError } from './error-format.plugin';

function makeFormattedError(
  message: string,
  extensions?: Record<string, unknown>,
): GraphQLFormattedError {
  return {
    message,
    extensions: extensions ?? {},
  };
}

describe('formatGraphQLError', () => {
  it('maps validation errors to UserError[] with field names', () => {
    const originalError = new BadRequestException({
      statusCode: 400,
      message: [
        'email must be an email',
        'password must be longer than 8 characters',
      ],
      error: 'Bad Request',
    });

    const graphQLError = new GraphQLError('Bad Request Exception', {
      originalError,
    });

    const result = formatGraphQLError(
      makeFormattedError('Bad Request Exception'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      field?: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(extensions.code).toBe('VALIDATION_ERROR');
    expect(extensions.field).toBe('email');
    expect(extensions.errors).toEqual([
      {
        code: 'VALIDATION_ERROR',
        field: 'email',
        message: 'email must be an email',
      },
      {
        code: 'VALIDATION_ERROR',
        field: 'password',
        message: 'password must be longer than 8 characters',
      },
    ]);
  });

  it('maps NotFoundException to NOT_FOUND', () => {
    const originalError = new NotFoundException('User not found');
    const graphQLError = new GraphQLError('User not found', {
      originalError,
    });

    const result = formatGraphQLError(
      makeFormattedError('User not found'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(result.message).toBe('User not found');
    expect(extensions.code).toBe('NOT_FOUND');
    expect(extensions.errors).toEqual([
      {
        code: 'NOT_FOUND',
        message: 'User not found',
      },
    ]);
  });

  it('masks internal errors in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const result = formatGraphQLError(
      makeFormattedError('database connection failed'),
      new GraphQLError('database connection failed'),
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(result.message).toBe('Something went wrong');
    expect(extensions.code).toBe('INTERNAL_ERROR');
    expect(extensions.errors).toEqual([
      {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    ]);

    process.env.NODE_ENV = previousNodeEnv;
  });

  it('maps UNAUTHORIZED exception to UNAUTHORIZED code', () => {
    const originalError = new UnauthorizedException('Not authenticated');
    const graphQLError = new GraphQLError('Not authenticated', {
      originalError,
    });

    const result = formatGraphQLError(
      makeFormattedError('Not authenticated'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(extensions.code).toBe('UNAUTHORIZED');
    expect(extensions.errors).toEqual([
      {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      },
    ]);
  });

  it('maps FORBIDDEN exception to FORBIDDEN code', () => {
    const originalError = new ForbiddenException('Access denied');
    const graphQLError = new GraphQLError('Access denied', {
      originalError,
    });

    const result = formatGraphQLError(
      makeFormattedError('Access denied'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(extensions.code).toBe('FORBIDDEN');
    expect(extensions.errors).toEqual([
      {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    ]);
  });

  it('maps serialized HttpException via originalError.statusCode', () => {
    const serializedError = new GraphQLError('Validation failed', {
      originalError: {
        statusCode: 400,
        message: ['name must not be empty'],
        error: 'Bad Request',
      } as unknown as Error,
    });

    const result = formatGraphQLError(
      makeFormattedError('Validation failed', {
        originalError: serializedError.originalError,
      }),
      serializedError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(extensions.code).toBe('VALIDATION_ERROR');
    expect(extensions.errors).toContainEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        field: 'name',
      }),
    );
  });

  it('maps GRAPHQL_VALIDATION_FAILED extension code to VALIDATION_ERROR', () => {
    const graphQLError = new GraphQLError(
      'Variable "$input" got invalid value',
      {
        extensions: {
          code: 'GRAPHQL_VALIDATION_FAILED',
        },
      },
    );

    const result = formatGraphQLError(
      makeFormattedError('Variable "$input" got invalid value', {
        code: 'GRAPHQL_VALIDATION_FAILED',
      }),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string }>;
    };

    expect(extensions.code).toBe('VALIDATION_ERROR');
    expect(extensions.errors).toEqual([
      {
        code: 'VALIDATION_ERROR',
        message: 'Variable "$input" got invalid value',
      },
    ]);
  });

  it('masks INTERNAL_SERVER_ERROR with generic message in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const originalError = new GraphQLError('database connection failed', {
      originalError: {
        statusCode: 500,
        message: 'database connection failed',
      } as unknown as Error,
    });

    const result = formatGraphQLError(
      makeFormattedError('database connection failed'),
      originalError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string }>;
    };

    expect(result.message).toBe('Something went wrong');
    expect(extensions.code).toBe('INTERNAL_ERROR');

    process.env.NODE_ENV = previousNodeEnv;
  });

  it('passthru non-HttpException errors in development mode', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const graphQLError = new GraphQLError('some unexpected error');

    const result = formatGraphQLError(
      makeFormattedError('some unexpected error'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string }>;
    };

    expect(extensions.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('some unexpected error');

    process.env.NODE_ENV = previousNodeEnv;
  });

  it('handles non-array validation message as string', () => {
    const originalError = new BadRequestException('Invalid input');
    const graphQLError = new GraphQLError('Invalid input', {
      originalError,
    });

    const result = formatGraphQLError(
      makeFormattedError('Invalid input'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      errors: Array<{ code: string; message: string }>;
    };

    expect(extensions.code).toBe('VALIDATION_ERROR');
    expect(extensions.errors).toEqual([
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
      },
    ]);
  });

  it('handles object constraint messages for field extraction', () => {
    const originalError = new BadRequestException({
      statusCode: 400,
      message: [
        {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
        },
      ],
      error: 'Bad Request',
    });

    const graphQLError = new GraphQLError('Bad Request Exception', {
      originalError,
    });

    const result = formatGraphQLError(
      makeFormattedError('Bad Request Exception'),
      graphQLError,
    );

    const extensions = result.extensions as {
      code: string;
      field?: string;
      errors: Array<{ code: string; message: string; field?: string }>;
    };

    expect(extensions.code).toBe('VALIDATION_ERROR');
    expect(extensions.field).toBe('email');
    expect(extensions.errors).toContainEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        field: 'email',
        message: 'email must be an email',
      }),
    );
  });
});
