# AI Agent Instructions - Meowingful App

Full-stack web application with user authentication and profile management. **Current implementation is MVP** - see [vibe-doc/spec.md](vibe-doc/spec.md) for full platform vision (multi-tenant CRM & E-Learning system).

Helpful documentation is stored in [vibe-doc](vibe-doc/) folder.

## vibe-doc Documentation Index

| Document | Description |
|----------|-------------|
| [spec.md](vibe-doc/spec.md) | Complete platform requirements - full technical specification for the multi-tenant CRM & E-Learning system |
| [architecture.md](vibe-doc/architecture.md) | System architecture, technology decisions, and evolution strategy from MVP to enterprise scale |
| [development-guide.md](vibe-doc/development-guide.md) | Practical developer guide with setup, workflows, coding patterns, and best practices |
| [project-overview.md](vibe-doc/project-overview.md) | Business vision, roadmap (phases 1-4), market positioning, and strategic context |
| [instruction.md](vibe-doc/instruction.md) | Story-driven development process - format, guidelines, and workflow for implementation stories |
| [story-01-quick-mvp.md](vibe-doc/story-01-quick-mvp.md) | Completed MVP implementation story - reference example showing the user authentication/profile feature |
| [README.md](vibe-doc/README.md) | Documentation index with navigation by role and quick project status summary |

See [README.md](README.md) for complete setup instructions and API documentation.
See [architecture.md](architecture.md) for architecture of the application.

## Quick Start Commands

**Development (Recommended):**
```bash
# Start all services with Docker
docker-compose up --build

# Access points:
# Frontend: http://localhost:8500  
# GraphQL Playground: http://localhost:3500/graphql
# Redis (with password): localhost:6379 (default password: redis-password)
```

**Local Development:**
```bash
# Backend (requires local PostgreSQL)
cd back-end && npm run start:dev

# Frontend  
cd front-end && npm run dev
```

## Architecture & Stack

- **Backend:** NestJS + GraphQL + Prisma + PostgreSQL + Redis
- **Frontend:** React + TypeScript + Apollo Client + Vite
- **DevOps:** Docker + Docker Compose

## Development Patterns

### Backend (NestJS + GraphQL + Prisma)

**Module Organization:**
- Feature modules: `src/{feature}/{feature}.{module|resolver|service|types}.ts`
- Global PrismaModule provides PrismaService everywhere
- Code-first GraphQL with decorator-based schema generation

**Key Conventions:**
- Separate `User` (profile) and `Auth` (credentials) tables for security
- Transaction-based operations for data consistency
- `@InputType()` for mutations, `@ObjectType()` for responses
- UUID primary keys with `@default(uuid())`

**Testing:**
- Unit tests: Co-located `.spec.ts` files with mocked PrismaService
- E2E tests: `/test/*.e2e-spec.ts` with real database cleanup
- Run: `npm run test` (unit) or `npm run test:e2e`

### Frontend (React + TypeScript + Apollo)

**Component Organization:**
- Pages: `/src/pages/` for route components
- Context: `/src/context/` for global state (AuthContext)
- GraphQL: `/src/graphql/` for queries and client setup

**Key Patterns:**
- AuthContext with localStorage persistence + useAuth hook
- PrivateRoute wrapper for protected pages
- Centralized GraphQL operations in `queries.ts`
- MockedProvider + MemoryRouter for testing components

**Testing:**
- Vitest with @testing-library/react
- Provider wrapper pattern for context-dependent components
- Run: `npm run test` (watch) or `npm run test:run`

### Database (Prisma + PostgreSQL)

**Development Workflow:**
```bash
# After schema changes
npx prisma generate    # Update client
npx prisma migrate dev # Create and apply migration

# Production deployment  
npx prisma migrate deploy  # Apply migrations (non-interactive)
```

**Schema Location:** `back-end/prisma/schema.prisma`

## Code Quality Tools

- **ESLint:** Configured for TypeScript in both frontend/backend
- **Prettier:** `.prettierrc` with consistent formatting rules  
- **TypeScript:** Strict mode with modern ES2023 target

## Common Tasks

### Adding New Features
1. Backend: Create module in `src/{feature}/` following auth module pattern
2. Update Prisma schema if needed → generate → migrate
3. Frontend: Add pages, update GraphQL queries, add routes
4. Test both unit and integration levels

### Database Changes
1. Modify `prisma/schema.prisma`
2. Run `npx prisma generate && npx prisma migrate dev`
3. Update GraphQL types and resolvers as needed
4. Add/update tests for new schema

### Deployment
- Production: `docker-compose up --build` (runs migrations automatically)
- Development: `docker-compose -f docker-compose.dev.yml up` (hot reload)

## Environment Variables

**Required:**
- Backend: `DATABASE_URL` (PostgreSQL connection)
- Backend: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (Redis connection)
- Frontend: `VITE_GRAPHQL_ENDPOINT` (GraphQL API URL)

See [README.md](README.md) for complete environment setup details.

## Security Notes

- Passwords: bcrypt hashed with salt storage in separate Auth table
- Username immutable after registration (security constraint)
- CORS configured for development ports (update for production)
- Use HTTPS and proper JWT tokens in production

## Project Structure

See [README.md](README.md) for detailed directory structure. Key directories:
- `back-end/src/` - NestJS application code
- `front-end/src/` - React application code  
- `back-end/prisma/` - Database schema and migrations
- `back-end/test/` and `front-end/src/**/*.test.*` - Test files