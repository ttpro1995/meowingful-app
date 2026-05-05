# Meowingful App - Development Guide

## Quick Start

### Prerequisites
- **Docker & Docker Compose**: For containerized development environment
- **Node.js 20+**: For local development (optional with Docker)
- **Git**: Version control
- **VS Code** (recommended): With TypeScript and GraphQL extensions

### Environment Setup

#### 1. Clone and Start (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd meowingful-app

# Start all services with Docker
docker-compose up --build

# Access points:
# Frontend: http://localhost:8500
# GraphQL Playground: http://localhost:3500/graphql
# Database: localhost:5432 (postgres/postgres)
```

#### 2. Local Development (Alternative)
```bash
# Backend setup (requires local PostgreSQL)
cd back-end
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Frontend setup (new terminal)
cd front-end  
npm install
npm run dev

# Access points:
# Frontend: http://localhost:5173
# Backend: http://localhost:3000/graphql
```

### Verification Steps
1. **Backend Health**: Visit GraphQL Playground at http://localhost:3500/graphql
2. **Frontend**: Open http://localhost:8500, register a new user
3. **Database**: Check PostgreSQL connection works
4. **Full Flow**: Register → Login → Edit Profile → Change Password

## Development Workflow

### Story-Driven Development
We use structured stories to guide feature development. See [instruction.md](instruction.md) for the complete story format.

#### Typical Story Workflow
```bash
1. 📖 Read the story completely
   - Understand user requirements and acceptance criteria
   - Review technical specifications and implementation plan

2. 🏗️ Plan the implementation  
   - Break down into small, testable commits
   - Identify affected components and services
   - Consider data model changes

3. 🔧 Implement step by step
   - Follow the implementation plan in the story
   - Write tests before or alongside implementation
   - Update story status and check off completed tasks

4. ✅ Verify and document
   - Run all tests (unit, integration, manual)
   - Update documentation for any architectural changes
   - Mark story as completed when all acceptance criteria are met
```

### Branch Strategy
```bash
# Feature development
git checkout -b feat/feature-name
# ... implement feature ...
git commit -m "feat: add user profile editing"

# Bug fixes  
git checkout -b fix/bug-description
git commit -m "fix: resolve login token expiration"

# Documentation updates
git checkout -b docs/update-readme
git commit -m "docs: update setup instructions"
```

### Commit Message Convention
```bash
# Format: type(scope): description

feat(auth): add password reset functionality
fix(profile): resolve bio update validation error  
docs(readme): update installation steps
test(user): add profile update test coverage
refactor(api): extract common validation logic
perf(db): optimize user query performance
```

## Code Architecture & Patterns

### Backend Development (NestJS + GraphQL + Prisma)

#### Project Structure
```
back-end/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── auth.module.ts       # Feature module definition
│   │   ├── auth.service.ts      # Business logic
│   │   ├── auth.resolver.ts     # GraphQL endpoints  
│   │   ├── auth.guard.ts        # Authorization guards
│   │   ├── dto/                 # Data transfer objects
│   │   │   ├── login.input.ts   # GraphQL input types
│   │   │   └── register.input.ts
│   │   └── __tests__/           # Unit and integration tests
│   │       ├── auth.service.spec.ts
│   │       └── auth.e2e-spec.ts
│   ├── user/                    # User management module  
│   ├── prisma/                  # Database service
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── app.module.ts            # Root application module
│   └── main.ts                  # Application entry point
├── prisma/
│   ├── schema.prisma            # Database schema definition
│   └── migrations/              # Database migration files
├── test/                        # E2E tests
└── Dockerfile                   # Container configuration
```

#### Module Development Pattern
```typescript
// 1. Define GraphQL types (code-first approach)
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;
  
  @Field()
  username: string;
  
  @Field({ nullable: true })  
  name?: string;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;
  
  @Field({ nullable: true })
  @IsString()
  @IsOptional()  
  bio?: string;
}

// 2. Implement service with business logic
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  
  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    // Validate user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    
    // Update user
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...input,
        updatedAt: new Date(),
      },
    });
  }
}

// 3. Create GraphQL resolver
@Resolver(() => User)
export class UserResolver {
  constructor(private userService: UserService) {}
  
  @Mutation(() => User)
  async updateUser(
    @Args('userId') userId: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.userService.updateUser(userId, input);
  }
}

// 4. Wire up in module
@Module({
  imports: [PrismaModule],
  providers: [UserService, UserResolver],
  exports: [UserService], // Export for use in other modules
})
export class UserModule {}
```

#### Database Development with Prisma
```bash
# Workflow for schema changes

1. Update schema.prisma
   # Add new fields or models

2. Generate Prisma client
   npx prisma generate

3. Create and apply migration
   npx prisma migrate dev --name add_user_bio_field

4. Update TypeScript types if needed
   # Prisma auto-generates types from schema
```

#### Testing Patterns
```typescript  
// Unit test pattern
describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();
    
    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });
  
  it('should update user successfully', async () => {
    // Arrange
    const userId = 'user-1';
    const input = { name: 'New Name' };
    const existingUser = { id: userId, username: 'testuser' };
    const updatedUser = { ...existingUser, ...input };
    
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(existingUser);
    jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);
    
    // Act
    const result = await service.updateUser(userId, input);
    
    // Assert
    expect(result.name).toBe('New Name');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining(input),
    });
  });
});

// E2E test pattern  
describe('User API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });
  
  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany();
    await prisma.auth.deleteMany();
  });
  
  it('should update user profile', async () => {
    // Create test user
    const user = await createTestUser();
    
    const updateMutation = `
      mutation UpdateUser($userId: String!, $input: UpdateUserInput!) {
        updateUser(userId: $userId, input: $input) {
          id
          name
          bio
        }
      }
    `;
    
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: updateMutation,
        variables: {
          userId: user.id,
          input: { name: 'Updated Name', bio: 'New bio' }
        }
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.updateUser.name).toBe('Updated Name');
        expect(res.body.data.updateUser.bio).toBe('New bio');
      });
  });
});
```

### Frontend Development (React + TypeScript + Apollo)

#### Project Structure  
```
front-end/
├── src/
│   ├── components/
│   │   ├── auth/                # Authentication components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── __tests__/
│   │   ├── common/              # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Loading.tsx
│   │   └── layout/              # Layout components
│   │       ├── Header.tsx
│   │       └── Navigation.tsx
│   ├── pages/                   # Route-level components
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── ProfilePage.tsx
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts
│   │   └── useLocalStorage.ts
│   ├── context/                 # React Context providers
│   │   └── AuthContext.tsx
│   ├── graphql/                 # GraphQL operations
│   │   ├── client.ts            # Apollo Client setup
│   │   ├── queries.ts           # GraphQL operations
│   │   └── types.ts             # Generated TypeScript types
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Helper functions
│   └── App.tsx                  # Root component
├── public/                      # Static assets
└── vite.config.ts              # Vite configuration
```

#### Component Development Pattern
```tsx
// 1. Define props interface
interface ProfileFormProps {
  user: User;
  onUpdate: (input: UpdateUserInput) => Promise<void>;
  loading?: boolean;
}

// 2. Create component with TypeScript
export function ProfileForm({ user, onUpdate, loading = false }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    bio: user.bio || '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await onUpdate(formData);
      // Success handling (could be handled by parent)
    } catch (error) {
      setErrors({ general: 'Failed to update profile' });
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <Input
        label="Display Name"
        value={formData.name}
        onChange={(value) => setFormData({ ...formData, name: value })}
        error={errors.name}
        disabled={loading}
      />
      
      <Input
        label="Bio"
        value={formData.bio}
        onChange={(value) => setFormData({ ...formData, bio: value })}
        error={errors.bio}
        disabled={loading}
        multiline
      />
      
      {errors.general && (
        <div className="error-message">{errors.general}</div>
      )}
      
      <Button 
        type="submit" 
        loading={loading}
        disabled={!formData.name.trim()}
      >
        Update Profile
      </Button>
    </form>
  );
}

// 3. Create container component with GraphQL
export function ProfilePage() {
  const { user } = useAuth();
  const [updateUser, { loading }] = useMutation(UPDATE_USER_MUTATION);
  
  const handleUpdate = async (input: UpdateUserInput) => {
    const result = await updateUser({
      variables: { userId: user.id, input },
    });
    
    // Update auth context with new user data
    // This could be handled by Apollo Cache or Context update
  };
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="profile-page">
      <h1>Edit Profile</h1>
      <ProfileForm 
        user={user} 
        onUpdate={handleUpdate} 
        loading={loading} 
      />
    </div>
  );
}
```

#### GraphQL Integration Pattern
```typescript
// graphql/queries.ts
import { gql } from '@apollo/client';

export const GET_USER = gql`
  query GetUser($userId: String!) {
    getUser(userId: $userId) {
      id
      username  
      name
      bio
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($userId: String!, $input: UpdateUserInput!) {
    updateUser(userId: $userId, input: $input) {
      id
      username
      name
      bio
      updatedAt
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        username
        name
        bio
      }
    }
  }
`;

// Usage in components
function useUserProfile(userId: string) {
  const { data, loading, error, refetch } = useQuery(GET_USER, {
    variables: { userId },
    skip: !userId, // Don't run query if no userId
  });
  
  return {
    user: data?.getUser,
    loading,
    error,
    refetch,
  };
}
```

#### Testing Patterns
```tsx
// Component test with mocked providers
describe('ProfileForm', () => {
  const mockUser: User = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    bio: 'Test bio',
  };
  
  const defaultProps = {
    user: mockUser,
    onUpdate: jest.fn().mockResolvedValue(undefined),
  };
  
  it('should update user when form is submitted', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    
    render(
      <ProfileForm {...defaultProps} onUpdate={onUpdate} />
    );
    
    // Change name field
    const nameInput = screen.getByLabelText('Display Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    
    // Submit form
    const submitButton = screen.getByText('Update Profile');
    fireEvent.click(submitButton);
    
    // Verify onUpdate was called
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        name: 'New Name',
        bio: 'Test bio',
      });
    });
  });
});

// Page test with Apollo MockedProvider
describe('ProfilePage', () => {
  const mocks = [
    {
      request: {
        query: UPDATE_USER_MUTATION,
        variables: {
          userId: 'user-1',
          input: { name: 'Updated Name' },
        },
      },
      result: {
        data: {
          updateUser: {
            id: 'user-1',
            username: 'testuser',
            name: 'Updated Name',
            bio: null,
            updatedAt: '2023-01-01T00:00:00Z',
          },
        },
      },
    },
  ];
  
  it('should handle profile update', async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <MemoryRouter>
          <AuthProvider>
            <ProfilePage />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );
    
    // Test profile update flow
    // ...
  });
});
```

## Development Best Practices

### Code Quality Standards

#### TypeScript Configuration
- **Strict Mode**: All TypeScript projects use strict type checking
- **No Implicit Any**: All variables must have explicit types
- **Consistent Naming**: PascalCase for components/classes, camelCase for functions/variables
- **Import Organization**: Absolute imports preferred, group by source (external, internal, relative)

#### Testing Requirements
```bash
# Minimum test coverage requirements
- Unit Tests: >80% code coverage for services and utilities
- Integration Tests: All GraphQL operations tested
- E2E Tests: Critical user flows (register, login, profile update)
- Component Tests: All interactive components tested
```

#### Security Standards
```typescript
// Input validation pattern
@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username must be alphanumeric' })
  username: string;
  
  @Field()
  @IsString()
  @Length(8, 100)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain letters and numbers' })
  password: string;
}

// Sensitive data handling
export class UserService {
  async createUser(input: CreateUserInput) {
    // Never log sensitive data
    this.logger.log(`Creating user: ${input.username}`); // ✅ OK
    // this.logger.log(`Creating user: ${input.password}`); // ❌ NEVER
    
    // Hash passwords immediately  
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);
    
    // Store in separate auth table
    return this.prisma.$transaction([
      // Create user profile
      this.prisma.user.create({
        data: { username: input.username, name: input.username },
      }),
      // Create auth record
      this.prisma.auth.create({
        data: { username: input.username, passwordHash },
      }),
    ]);
  }
}
```

### Performance Guidelines

#### Database Optimization
```typescript
// Use select to limit returned fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, username: true, name: true }, // Only return needed fields
});

// Use include for related data (avoid N+1 queries)
const usersWithAuth = await prisma.user.findMany({
  include: { auth: true }, // Single query with join
});

// Use cursor-based pagination for large datasets
const users = await prisma.user.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastUserId },
  orderBy: { createdAt: 'desc' },
});
```

#### Frontend Performance
```tsx
// Lazy load components
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Memoize expensive calculations
const ExpensiveComponent = memo(({ data }: { data: ComplexData[] }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveCalculation(item));
  }, [data]);
  
  return <DataVisualization data={processedData} />;
});

// Use callback to prevent unnecessary re-renders
function UserList({ users, onUserSelect }: UserListProps) {
  const handleUserClick = useCallback((user: User) => {
    onUserSelect(user);
  }, [onUserSelect]);
  
  return (
    <div>
      {users.map(user => (
        <UserCard 
          key={user.id} 
          user={user} 
          onClick={handleUserClick}
        />
      ))}
    </div>
  );
}
```

## Debugging & Troubleshooting

### Common Issues & Solutions

#### Backend Issues
```bash
# Database connection errors
Error: P1001: Can't reach database server
→ Check PostgreSQL container is running: docker-compose ps
→ Verify DATABASE_URL in .env file
→ Ensure network connectivity between containers

# Prisma schema sync issues  
Error: Unknown field `newField` on model `User`
→ Run: npx prisma generate
→ Run: npx prisma migrate dev
→ Restart NestJS server

# GraphQL type errors
Error: Cannot determine GraphQL output type
→ Ensure @ObjectType() decorator on classes
→ Check @Field() decorators have correct types
→ Verify imports of custom types
```

#### Frontend Issues
```bash
# Apollo Client cache issues
Warning: Cache data may be lost
→ Check GraphQL operation names are unique
→ Verify __typename is included in queries
→ Consider cache.refetchQueries() after mutations

# Type generation issues
Error: Cannot find name 'GetUserQuery'
→ Run: npm run codegen (if configured)
→ Check graphql operations are properly exported
→ Verify Apollo Client configuration

# Build/import errors
Error: Cannot resolve './component'
→ Check file extensions (.tsx vs .ts)
→ Verify import paths are correct
→ Check Vite configuration for path aliases
```

### Logging & Monitoring

#### Development Logging
```typescript
// Backend logging (NestJS)
import { Logger } from '@nestjs/common';

@Injectable() 
export class UserService {
  private readonly logger = new Logger(UserService.name);
  
  async updateUser(userId: string, input: UpdateUserInput) {
    this.logger.log(`Updating user ${userId}`);
    
    try {
      const result = await this.prisma.user.update({
        where: { id: userId },
        data: input,
      });
      
      this.logger.log(`Successfully updated user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update user ${userId}:`, error.message);
      throw error;
    }
  }
}

// Frontend logging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },
};

// Usage in components
function LoginForm() {
  const [login] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      logger.info('Login successful', { userId: data.login.user.id });
    },
    onError: (error) => {
      logger.error('Login failed', error);
    },
  });
}
```

### Development Tools

#### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "graphql.vscode-graphql",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-jest",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### Useful Scripts
```json
{
  "scripts": {
    "dev": "docker-compose up",
    "dev:build": "docker-compose up --build", 
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "cd back-end && npm run test && npm run test:e2e",
    "test:frontend": "cd front-end && npm run test:run",
    "db:reset": "cd back-end && npx prisma migrate reset",
    "db:seed": "cd back-end && npx prisma db seed",
    "logs": "docker-compose logs -f",
    "clean": "docker-compose down -v && docker system prune -f"
  }
}
```

## Contributing Guidelines

### Pull Request Process
1. **Create Feature Branch**: `git checkout -b feat/feature-name`
2. **Implement Changes**: Follow coding standards and write tests
3. **Update Documentation**: Update relevant docs for any architectural changes
4. **Test Thoroughly**: Ensure all tests pass and manual testing completed
5. **Create Pull Request**: Use descriptive title and detailed description
6. **Code Review**: Address feedback and iterate as needed

### Code Review Checklist
- [ ] **Functionality**: Code meets acceptance criteria
- [ ] **Testing**: Adequate test coverage for new/changed code  
- [ ] **Security**: No security vulnerabilities introduced
- [ ] **Performance**: No obvious performance regressions
- [ ] **Documentation**: Code is well-documented and self-explanatory
- [ ] **Standards**: Follows project coding standards and conventions

### Release Process
```bash
# Version bumping
npm version patch  # Bug fixes
npm version minor  # New features  
npm version major  # Breaking changes

# Deployment
git tag v1.0.0
git push origin v1.0.0
# Deploy via CI/CD pipeline
```

## Useful Resources

### Internal Documentation
- [README.md](../README.md) - Project overview and setup
- [AGENTS.md](../AGENTS.md) - AI agent instructions
- [architecture.md](architecture.md) - Technical architecture details
- [project-overview.md](project-overview.md) - Business context and roadmap
- [spec.md](spec.md) - Complete platform requirements

### External Resources
- [NestJS Documentation](https://docs.nestjs.com/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [Prisma Guides](https://www.prisma.io/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)

### Community & Support
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Code Review**: All changes require review for quality and security

---

**Happy coding! 🚀**

Remember: Start simple, build incrementally, test thoroughly, and document everything. The current MVP provides a solid foundation for the amazing platform we're building together.