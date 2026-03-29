import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { useMutation, useQuery } from '@apollo/client/react';

export { ApolloProvider, useMutation, useQuery };
export const client = new ApolloClient({
  link: createHttpLink({
    uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
  }),
  cache: new InMemoryCache(),
});
