import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Login from '../pages/Login';

describe('Login Page', () => {
  it('renders login form correctly', () => {
    render(
      <MockedProvider>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(screen.getByRole('heading', { name: /Login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });
});
