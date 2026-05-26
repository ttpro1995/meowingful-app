import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNavigate, Link } from 'react-router-dom';
import { REGISTER } from '../graphql/queries';
import { useAuth } from '../context/useAuth';

interface RegisterData {
  register: {
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

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [register, { loading }] = useMutation<RegisterData>(REGISTER);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { data } = await register({
        variables: {
          input: { username, password, name },
        },
      });

      if (data?.register) {
        login(data.register.accessToken, data.register.user);
        navigate('/profile');
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'graphQLErrors' in err) {
        const graphqlError = err as { graphQLErrors: Array<{ message: string }> };
        setError(graphqlError.graphQLErrors[0]?.message || 'Registration failed');
      } else {
        setError('Registration failed');
      }
    }
  };

  return (
    <div className="container">
      <h1>Register</h1>
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
            minLength={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="name">Display Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            minLength={6}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      <p className="form-footer">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
