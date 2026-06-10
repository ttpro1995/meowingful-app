import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider, client } from './graphql/client';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Register from './pages/Register';
import Login from './pages/Login';
import Profile from './pages/Profile';
import InviteResponse from './pages/InviteResponse';
import Dashboard from './pages/Dashboard';
import './App.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/invite" element={<InviteResponse />} />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/profile" />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;