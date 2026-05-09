import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Profile from '../pages/Profile';
import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { GET_USER } from '../graphql/queries';

const mocks = [
  {
    request: {
      query: GET_USER,
      variables: {
        userId: '123',
      },
    },
    result: {
      data: {
        getUser: {
          id: '123',
          username: 'testuser',
          name: 'Test User',
          bio: 'Test bio',
          createdAt: '2026-03-29T00:00:00Z',
          updatedAt: '2026-03-29T00:00:00Z',
        },
      },
    },
  },
];

describe('Profile Page', () => {
  it('renders profile information correctly', async () => {
    // We need to mock the AuthContext user to be logged in
    const localStorageMock = (function() {
      let store: Record<string, string> = {
        token: 'fake-token',
        user: JSON.stringify({ id: '123', username: 'testuser', name: 'Test User', bio: 'Test bio' }),
      };
      return {
        getItem: function(key: string) {
          return store[key];
        },
        setItem: function(key: string, value: string) {
          store[key] = value.toString();
        },
        removeItem: function(key: string) {
          delete store[key];
        },
        clear: function() {
          store = {};
        }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    // Initial load might show "Loading profile..." or similar if implemented
    // But since we are mocking the context user, it might show the user info from context first
    expect(await screen.findByRole('heading', { level: 1, name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByText(/testuser/i)).toBeInTheDocument();
    expect(await screen.findByText(/Test User/i)).toBeInTheDocument();
    expect(await screen.findByText(/Test bio/i)).toBeInTheDocument();
  });
});
