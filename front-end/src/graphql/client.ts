import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, concat } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { useMutation, useQuery } from '@apollo/client/react';

export { ApolloProvider, useMutation, useQuery };

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3500/graphql',
});

const authMiddleware = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('token');
  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });
  return forward(operation);
});

export const client = new ApolloClient({
  link: concat(authMiddleware, httpLink),
  cache: new InMemoryCache(),
});
