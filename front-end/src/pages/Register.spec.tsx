import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Register from '../pages/Register';
import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';

describe('Register Page', () => {
  it('renders register form correctly', () => {
    render(
      <MockedProvider>
        <MemoryRouter>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(screen.getByRole('heading', { name: /Register/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
  });
});
