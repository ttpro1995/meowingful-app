import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { formatGraphQLError } from './error-format.plugin';

function makeFormattedError(message: string): GraphQLFormattedError {
  return {
    message,
    extensions: {},
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
});
