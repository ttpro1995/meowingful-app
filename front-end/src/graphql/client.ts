import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
  Observable,
  from,
} from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { useMutation, useQuery } from '@apollo/client/react';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { print } from 'graphql/language/printer';
import { REFRESH_TOKEN } from './queries';

export { ApolloProvider, useMutation, useQuery };

const graphqlEndpoint =
  import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3500/graphql';

const httpLink = createHttpLink({
  uri: graphqlEndpoint,
  credentials: 'include',
});

async function requestNewAccessToken(): Promise<string | null> {
  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: print(REFRESH_TOKEN) }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: {
      refreshToken?: {
        accessToken?: string;
      };
    };
  };

  return payload.data?.refreshToken?.accessToken ?? null;
}

const authMiddleware = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('token');
  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });
  return forward(operation);
});

const errorLink = new ErrorLink(({ error, operation, forward }) => {
  if (!CombinedGraphQLErrors.is(error)) {
    return;
  }

  const hasUnauthenticatedGraphQLError = error.errors.some(
    (e) => (e.extensions?.code as string | undefined) === 'UNAUTHENTICATED',
  );

  if (!forward || !hasUnauthenticatedGraphQLError) {
    return;
  }

  const context = operation.getContext();
  if (context.alreadyRetried) {
    return;
  }

  return new Observable((observer) => {
    let subscription: { unsubscribe: () => void } | undefined;

    void requestNewAccessToken()
      .then((newAccessToken) => {
        if (!newAccessToken) {
          throw new Error('Session refresh failed');
        }

        localStorage.setItem('token', newAccessToken);

        operation.setContext({
          ...context,
          alreadyRetried: true,
          headers: {
            ...(context.headers as Record<string, string> | undefined),
            authorization: `Bearer ${newAccessToken}`,
          },
        });

        subscription = forward(operation).subscribe({
          next: (result) => observer.next(result),
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        });
      })
      .catch((error: unknown) => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        observer.error(error);
      });

    return () => {
      subscription?.unsubscribe();
    };
  });
});

export const client = new ApolloClient({
  link: from([errorLink, authMiddleware, httpLink]),
  cache: new InMemoryCache(),
});
