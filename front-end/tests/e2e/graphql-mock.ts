import { type Page, type Route } from '@playwright/test';

interface MockUser {
  id: string;
  tenantId: string;
  username: string;
  name: string;
  bio: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredUser {
  user: MockUser;
  password: string;
}

interface GraphQLRequestBody {
  query?: string;
  variables?: {
    input?: {
      username?: string;
      password?: string;
      name?: string;
      bio?: string;
    };
    userId?: string;
    tenantId?: string;
  };
}

function buildUser(username: string, name: string): MockUser {
  const now = new Date().toISOString();
  const id = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    tenantId: 'tenant-default',
    username,
    name,
    bio: null,
    role: 'USER',
    createdAt: now,
    updatedAt: now,
  };
}

function authPayload(user: MockUser) {
  return {
    accessToken: `token-${user.id}`,
    user,
  };
}

async function fulfillData(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data }),
  });
}

async function fulfillError(route: Route, message: string, code = 'BAD_USER_INPUT') {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      errors: [
        {
          message,
          extensions: { code },
        },
      ],
      data: null,
    }),
  });
}

export async function setupGraphqlMock(page: Page): Promise<void> {
  const usersById = new Map<string, StoredUser>();
  const usersByUsername = new Map<string, StoredUser>();
  let activeUserId: string | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as GraphQLRequestBody;
    const query = payload?.query ?? '';
    const variables = payload?.variables ?? {};

    if (query.includes('mutation Register')) {
      const username = variables.input?.username ?? '';
      const password = variables.input?.password ?? '';
      const name = variables.input?.name ?? '';

      if (!username || !password || !name) {
        await fulfillError(route, 'Registration failed', 'VALIDATION_ERROR');
        return;
      }

      if (usersByUsername.has(username)) {
        await fulfillError(route, 'Username already exists', 'CONFLICT');
        return;
      }

      const user = buildUser(username, name);
      const stored: StoredUser = { user, password };
      usersByUsername.set(username, stored);
      usersById.set(user.id, stored);
      activeUserId = user.id;

      await fulfillData(route, {
        register: authPayload(user),
      });
      return;
    }

    if (query.includes('mutation Login')) {
      const username = variables.input?.username ?? '';
      const password = variables.input?.password ?? '';
      const stored = usersByUsername.get(username);

      if (!stored || stored.password !== password) {
        await fulfillError(route, 'Invalid credentials', 'UNAUTHENTICATED');
        return;
      }

      activeUserId = stored.user.id;
      await fulfillData(route, {
        login: authPayload(stored.user),
      });
      return;
    }

    if (query.includes('mutation Logout')) {
      activeUserId = null;
      await fulfillData(route, {
        logout: true,
      });
      return;
    }

    if (query.includes('mutation RefreshToken')) {
      if (!activeUserId || !usersById.has(activeUserId)) {
        await fulfillError(route, 'Session refresh failed', 'UNAUTHENTICATED');
        return;
      }

      const stored = usersById.get(activeUserId);
      if (!stored) {
        await fulfillError(route, 'Session refresh failed', 'UNAUTHENTICATED');
        return;
      }

      await fulfillData(route, {
        refreshToken: authPayload(stored.user),
      });
      return;
    }

    if (query.includes('query GetUser')) {
      const userId = variables.userId ?? activeUserId ?? '';
      const stored = usersById.get(userId);

      if (!stored) {
        await fulfillError(route, 'User not found', 'NOT_FOUND');
        return;
      }

      await fulfillData(route, {
        getUser: stored.user,
      });
      return;
    }

    if (query.includes('query MyTenants')) {
      const tenantId = usersById.get(activeUserId ?? '')?.user.tenantId ?? 'tenant-default';

      await fulfillData(route, {
        myTenants: {
          memberships: [
            {
              tenantId,
              tenantName: 'Default Tenant',
              tenantSlug: 'default',
              roleNames: ['DEVELOPER'],
            },
          ],
        },
      });
      return;
    }

    if (query.includes('mutation UpdateUser')) {
      const userId = variables.userId ?? activeUserId ?? '';
      const stored = usersById.get(userId);

      if (!stored) {
        await fulfillError(route, 'Update failed', 'NOT_FOUND');
        return;
      }

      const updatedUser: MockUser = {
        ...stored.user,
        name: variables.input?.name ?? stored.user.name,
        bio: variables.input?.bio ?? stored.user.bio,
        updatedAt: new Date().toISOString(),
      };

      const updatedStored: StoredUser = {
        ...stored,
        user: updatedUser,
      };

      usersById.set(userId, updatedStored);
      usersByUsername.set(updatedUser.username, updatedStored);

      await fulfillData(route, {
        updateUser: updatedUser,
      });
      return;
    }

    if (query.includes('mutation ChangePassword')) {
      await fulfillData(route, {
        changePassword: true,
      });
      return;
    }

    if (query.includes('mutation SwitchTenant')) {
      const stored = usersById.get(activeUserId ?? '');
      if (!stored) {
        await fulfillError(route, 'Failed to switch tenant', 'UNAUTHENTICATED');
        return;
      }

      const switchedUser: MockUser = {
        ...stored.user,
        tenantId: variables.tenantId ?? stored.user.tenantId,
      };

      const updatedStored: StoredUser = {
        ...stored,
        user: switchedUser,
      };

      usersById.set(switchedUser.id, updatedStored);
      usersByUsername.set(switchedUser.username, updatedStored);

      await fulfillData(route, {
        switchTenant: authPayload(switchedUser),
      });
      return;
    }

    await fulfillData(route, {});
  });
}
