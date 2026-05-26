import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { LOGIN } from '../graphql/queries';
import { useAuth } from '../context/useAuth';

interface LoginData {
  login: {
    accessToken: string;
    user: {
      id: string;
      tenantId: string;
      username: string;
      name: string;
      bio: string | null;
      role: string;
    };
  };
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginMutation, { loading }] = useMutation<LoginData>(LOGIN);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { data } = await loginMutation({
        variables: {
          input: { username, password },
        },
      });

      if (data?.login) {
        login(data.login.accessToken, data.login.user);
        const inviteToken = searchParams.get('inviteToken');
        if (inviteToken) {
          navigate(`/invite?token=${encodeURIComponent(inviteToken)}`);
        } else {
          navigate('/profile');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'graphQLErrors' in err) {
        const graphqlError = err as { graphQLErrors: Array<{ message: string }> };
        setError(graphqlError.graphQLErrors[0]?.message || 'Login failed');
      } else {
        setError('Login failed');
      }
    }
  };

  return (
    <div className="container">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="form">
        {error && <div className="error">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="form-footer">
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}