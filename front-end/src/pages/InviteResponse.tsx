import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ACCEPT_INVITATION, DECLINE_INVITATION } from '../graphql/queries';
import { useAuth } from '../context/useAuth';

interface AcceptInvitationData {
  acceptInvitation: boolean;
}

interface DeclineInvitationData {
  declineInvitation: boolean;
}

function toGraphQLErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && 'graphQLErrors' in error) {
    const graphqlError = error as { graphQLErrors: Array<{ message: string }> };
    return graphqlError.graphQLErrors[0]?.message || fallback;
  }

  return fallback;
}

export default function InviteResponse() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token: accessToken } = useAuth();
  const invitationToken = searchParams.get('token')?.trim() ?? '';

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [responded, setResponded] = useState(false);

  const [acceptInvitation, { loading: accepting }] =
    useMutation<AcceptInvitationData>(ACCEPT_INVITATION);
  const [declineInvitation, { loading: declining }] =
    useMutation<DeclineInvitationData>(DECLINE_INVITATION);

  const isSubmitting = accepting || declining;

  const handleAccept = async () => {
    setError('');
    setSuccess('');

    try {
      const { data } = await acceptInvitation({
        variables: {
          input: {
            token: invitationToken,
          },
        },
      });

      if (data?.acceptInvitation) {
        setResponded(true);
        setSuccess('Invitation accepted. You can now switch to this tenant from your profile.');
      }
    } catch (err: unknown) {
      setError(toGraphQLErrorMessage(err, 'Failed to accept invitation'));
    }
  };

  const handleDecline = async () => {
    setError('');
    setSuccess('');

    try {
      const { data } = await declineInvitation({
        variables: {
          input: {
            token: invitationToken,
          },
        },
      });

      if (data?.declineInvitation) {
        setResponded(true);
        setSuccess('Invitation declined.');
      }
    } catch (err: unknown) {
      setError(toGraphQLErrorMessage(err, 'Failed to decline invitation'));
    }
  };

  if (!invitationToken) {
    return (
      <div className="container">
        <h1>Invitation</h1>
        <div className="error">Invitation token is missing or invalid.</div>
        <p className="form-footer">
          <Link to="/profile">Go to profile</Link>
        </p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="container">
        <h1>Invitation</h1>
        <div className="profile-section">
          <p>Please log in first to respond to this invitation.</p>
          <div className="button-group">
            <Link
              to={`/login?inviteToken=${encodeURIComponent(invitationToken)}`}
              className="btn-primary"
            >
              Login
            </Link>
            <Link to="/register" className="btn-secondary">
              Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Invitation</h1>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="profile-section">
        <h2>Respond to tenant invitation</h2>
        <p>
          Choose whether to accept or decline this invitation.
        </p>

        {!responded ? (
          <div className="button-group">
            <button
              type="button"
              onClick={handleAccept}
              className="btn-primary"
              disabled={isSubmitting}
            >
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              {declining ? 'Declining...' : 'Decline Invitation'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/profile')}
          >
            Go to Profile
          </button>
        )}
      </div>
    </div>
  );
}
