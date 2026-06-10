import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
  Observable,
  from,
  split,
} from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { print } from 'graphql/language/printer';
import { createClient } from 'graphql-ws';
import { REFRESH_TOKEN } from './queries';

export { ApolloProvider, useMutation, useQuery, useSubscription };

const graphqlEndpoint =
  import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3500/graphql';

const httpLink = createHttpLink({
  uri: graphqlEndpoint,
  credentials: 'include',
});

const wsEndpoint = graphqlEndpoint.replace(/^http/, 'ws');
const hasWebSocketRuntime =
  typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';

const wsLink = hasWebSocketRuntime
  ? new GraphQLWsLink(
      createClient({
        url: wsEndpoint,
        connectionParams: () => {
          const token = localStorage.getItem('token');
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    )
  : null;

const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink,
    )
  : httpLink;

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
  link: from([errorLink, authMiddleware, splitLink]),
  cache: new InMemoryCache(),
});
