import { gql } from '@apollo/client/core';

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        name
        bio
        createdAt
        updatedAt
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        username
        name
        bio
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_USER = gql`
  query GetUser($userId: String!) {
    getUser(userId: $userId) {
      id
      username
      name
      bio
      createdAt
      updatedAt
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      username
      name
      bio
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($userId: String!, $input: UpdateUserInput!) {
    updateUser(userId: $userId, input: $input) {
      id
      username
      name
      bio
      createdAt
      updatedAt
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($userId: String!, $input: ChangePasswordInput!) {
    changePassword(userId: $userId, input: $input)
  }
`;
