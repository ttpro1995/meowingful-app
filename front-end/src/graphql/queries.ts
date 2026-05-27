import { gql } from '@apollo/client/core';

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      user {
        id
        tenantId
        username
        name
        bio
        role
        createdAt
        updatedAt
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      user {
        id
        tenantId
        username
        name
        bio
        role
        createdAt
        updatedAt
      }
    }
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken {
    refreshToken {
      accessToken
      user {
        id
        tenantId
        username
        name
        bio
        role
        createdAt
        updatedAt
      }
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const GET_USER = gql`
  query GetUser($userId: String!) {
    getUser(userId: $userId) {
      id
      tenantId
      username
      name
      bio
      role
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($userId: String!, $input: UpdateUserInput!) {
    updateUser(userId: $userId, input: $input) {
      id
      tenantId
      username
      name
      bio
      role
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

export const MY_TENANTS = gql`
  query MyTenants {
    myTenants {
      memberships {
        tenantId
        tenantName
        tenantSlug
        roleNames
      }
    }
  }
`;

export const MY_TENANT = gql`
  query MyTenant {
    myTenant {
      id
      name
      slug
      logoUrl
    }
  }
`;

export const TENANT_CONFIG = gql`
  query TenantConfig {
    tenantConfig {
      id
      tenantId
      logoUrl
      primaryColor
      subdomain
      timezone
      defaultLanguage
      businessHours {
        mon
        tue
        wed
        thu
        fri
        sat
        sun
      }
      features {
        crm
        elearning
        call_center
        live_classes
        marketplace
      }
    }
  }
`;

export const UPDATE_TENANT_CONFIG = gql`
  mutation UpdateTenantConfig($input: UpdateTenantConfigInput!) {
    updateTenantConfig(input: $input) {
      id
      tenantId
      logoUrl
      primaryColor
      subdomain
      timezone
      defaultLanguage
      businessHours {
        mon
        tue
        wed
        thu
        fri
        sat
        sun
      }
      features {
        crm
        elearning
        call_center
        live_classes
        marketplace
      }
    }
  }
`;

export const SWITCH_TENANT = gql`
  mutation SwitchTenant($tenantId: String!) {
    switchTenant(tenantId: $tenantId) {
      accessToken
      user {
        id
        tenantId
        username
        name
        bio
        role
        createdAt
        updatedAt
      }
    }
  }
`;

export const ACCEPT_INVITATION = gql`
  mutation AcceptInvitation($input: AcceptInvitationInput!) {
    acceptInvitation(input: $input)
  }
`;

export const DECLINE_INVITATION = gql`
  mutation DeclineInvitation($input: DeclineInvitationInput!) {
    declineInvitation(input: $input)
  }
`;
