import { MembershipResolver } from './membership.resolver';
import { MembershipService } from './membership.service';

describe('MembershipResolver', () => {
  const inviteMember = jest.fn();
  const acceptInvitation = jest.fn();
  const declineInvitation = jest.fn();
  const members = jest.fn();
  const updateMemberRoles = jest.fn();
  const removeMember = jest.fn();
  const myTenants = jest.fn();

  const membershipService = {
    inviteMember,
    acceptInvitation,
    declineInvitation,
    members,
    updateMemberRoles,
    removeMember,
    myTenants,
  } as unknown as MembershipService;

  const resolver = new MembershipResolver(membershipService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates inviteMember mutation to service', async () => {
    const input = {
      email: 'user@example.com',
      roleId: 'role-1',
    };
    inviteMember.mockResolvedValueOnce({ invitationToken: 'token' });

    const result = await resolver.inviteMember(input);

    expect(inviteMember).toHaveBeenCalledWith(input);
    expect(result).toEqual({ invitationToken: 'token' });
  });

  it('delegates acceptInvitation mutation to service', async () => {
    const input = { token: 'token-1' };
    acceptInvitation.mockResolvedValueOnce(true);

    const result = await resolver.acceptInvitation(input);

    expect(acceptInvitation).toHaveBeenCalledWith(input);
    expect(result).toBe(true);
  });

  it('delegates declineInvitation mutation to service', async () => {
    const input = { token: 'token-1' };
    declineInvitation.mockResolvedValueOnce(true);

    const result = await resolver.declineInvitation(input);

    expect(declineInvitation).toHaveBeenCalledWith(input);
    expect(result).toBe(true);
  });

  it('calls members with empty query when query is not provided', async () => {
    members.mockResolvedValueOnce({ members: [], totalCount: 0 });

    const result = await resolver.members();

    expect(members).toHaveBeenCalledWith({});
    expect(result).toEqual({ members: [], totalCount: 0 });
  });

  it('delegates updateMemberRoles mutation to service', async () => {
    const input = {
      userId: 'user-1',
      roleIds: ['role-1'],
    };
    updateMemberRoles.mockResolvedValueOnce({ id: 'user-1' });

    const result = await resolver.updateMemberRoles(input);

    expect(updateMemberRoles).toHaveBeenCalledWith(input);
    expect(result).toEqual({ id: 'user-1' });
  });

  it('delegates removeMember mutation to service', async () => {
    removeMember.mockResolvedValueOnce(true);

    const result = await resolver.removeMember('user-1');

    expect(removeMember).toHaveBeenCalledWith('user-1');
    expect(result).toBe(true);
  });

  it('delegates myTenants query to service', async () => {
    myTenants.mockResolvedValueOnce({ memberships: [] });

    const result = await resolver.myTenants();

    expect(myTenants).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ memberships: [] });
  });
});
