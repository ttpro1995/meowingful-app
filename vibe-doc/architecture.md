# Meowingful App - Architecture Documentation

## Overview

Meowingful App is designed as a scalable multi-tenant platform that will evolve from a simple authentication MVP to a comprehensive CRM & E-Learning system. This document outlines the current architecture, planned evolution, and key design decisions.

## Current State (MVP)

### Architecture Summary
- **Pattern**: Traditional 3-tier web application
- **Data Flow**: Client → API Gateway → Business Logic → Database
- **Deployment**: Containerized microservices with Docker Compose
- **State**: Authentication and profile management only

### Technology Stack

#### Backend
- **Framework**: NestJS (Node.js/TypeScript)
- **API Layer**: GraphQL with code-first approach
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + bcrypt password hashing
- **Validation**: Class-validator decorators

#### Frontend  
- **Framework**: React 18 + TypeScript
- **State Management**: React Context + localStorage
- **GraphQL Client**: Apollo Client
- **Routing**: React Router
- **Build Tool**: Vite
- **Testing**: Vitest + Testing Library

#### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (frontend proxy)
- **Development**: Hot-reload with volume mounts
- **Database**: PostgreSQL container

### Current Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                          │
├─────────────────────────────────────────────────────────────┤
│  React App (Port 8500/5173)                                │
│  ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │   AuthContext   │ │ Apollo Client │ │     Router      │   │
│  └─────────────────┘ └──────────────┘ └─────────────────┘   │
│  ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │  Register Page  │ │  Login Page  │ │  Profile Page   │   │
│  └─────────────────┘ └──────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                │
                         GraphQL over HTTP
                                │
┌─────────────────────────────────────────────────────────────┐
│              NestJS Backend (Port 3500/3000)                │
├─────────────────────────────────────────────────────────────┤
│  GraphQL API Layer                                          │
│  ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │  Auth Resolver  │ │ Auth Service │ │  Auth Module    │   │
│  └─────────────────┘ └──────────────┘ └─────────────────┘   │
│                                │                            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Prisma ORM Layer                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                          Database Connection
                                │
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Port 5432)                │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                    │
│  ┌─────────────────┐ ┌──────────────────────────────────┐   │
│  │   User Table    │ │        Auth Table                │   │
│  │  (Profile)      │ │      (Credentials)               │   │
│  └─────────────────┘ └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Architecture

#### Security-First Design
```sql
-- Profile data (publicly shareable)
User {
  id        UUID PRIMARY KEY
  username  VARCHAR UNIQUE (immutable)
  name      VARCHAR (editable display name)  
  bio       TEXT (optional, editable)
  createdAt TIMESTAMP
  updatedAt TIMESTAMP
}

-- Sensitive authentication data (isolated)
Auth {
  id           UUID PRIMARY KEY
  userId       UUID FOREIGN KEY → User.id
  username     VARCHAR UNIQUE (duplicate for lookup)
  passwordHash VARCHAR (bcrypt hashed)
  salt         VARCHAR (bcrypt salt)
  createdAt    TIMESTAMP  
  updatedAt    TIMESTAMP
}
```

#### Key Security Decisions
1. **Credential Isolation**: Auth data separated from profile to limit exposure
2. **Immutable Username**: Prevents security issues with identity changes
3. **Salt + Hash**: Individual salts with bcrypt for password security
4. **No Plaintext Storage**: Passwords never stored or logged in plaintext

## Future State Architecture

### Target Platform Vision
The platform will evolve into a comprehensive multi-tenant system supporting:
- **CRM & Sales Management** 
- **E-Learning & Course Management**
- **Communication & Call Center**
- **Teacher/Freelancer Marketplace**
- **Student Learning Portal**
- **Internal Social Network**

### Planned Architectural Evolution

#### Multi-Tenant Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                   Load Balancer / CDN                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                 API Gateway                                 │
│  ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │  Authentication │ │ Rate Limiting│ │  Tenant Routing │   │
│  └─────────────────┘ └──────────────┘ └─────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────────┐ ┌──▼──────────┐
│   CRM Core   │ │ E-Learning │ │    Admin    │
│   Service    │ │  Service   │ │   Service   │
└──────────────┘ └────────────┘ └─────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Shared Data Layer                              │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │ PostgreSQL  │ │    Redis     │ │   File Storage      │   │
│  │ (Primary)   │ │   (Cache)    │ │   (S3/MinIO)        │   │
│  └─────────────┘ └──────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Service Architecture (Microservices)
```
Core Services:
├── auth-service/          # Authentication & authorization  
├── tenant-service/        # Multi-tenant management
├── user-service/          # User profiles & management
├── crm-service/          # Customer & lead management
├── learning-service/     # Course & content management
├── communication-service/ # VoIP, calls, messaging
├── payment-service/      # Payments & billing
├── notification-service/ # Email, SMS, push notifications
└── media-service/        # File storage & processing

Support Services:
├── api-gateway/          # Request routing & aggregation
├── event-bus/            # Inter-service messaging  
├── monitoring-service/   # Logging, metrics, health
└── analytics-service/    # Reporting & dashboards
```

### Database Evolution Strategy

#### Phase 1: Single Database (Current MVP)
```
meowingful_db/
├── users/           # User profiles
├── auth/            # Authentication credentials  
└── audit_logs/      # System activity tracking
```

#### Phase 2: Modular Single Database  
```
meowingful_platform_db/
├── core/
│   ├── tenants/          # Organization management
│   ├── users/            # Cross-tenant user directory
│   └── permissions/      # RBAC system
├── crm/
│   ├── leads/            # Lead management
│   ├── customers/        # Customer data
│   └── sales_pipeline/   # Sales workflow
├── learning/
│   ├── courses/          # Course catalog
│   ├── content/          # Learning materials
│   ├── enrollments/      # Student-course relationships
│   └── assessments/      # Exams & assignments
└── communication/
    ├── call_logs/        # VoIP call records
    ├── campaigns/        # Marketing campaigns  
    └── templates/        # Message templates
```

#### Phase 3: Distributed Databases (Future)
- **Service-per-database** pattern
- **Event-driven consistency** between services
- **Read replicas** for analytics
- **Data warehousing** for reporting

## Technology Evolution Roadmap

### Phase 1: MVP Enhancement (Current → 6 months)
**Goal**: Stabilize current stack, add basic multi-tenancy

**Backend Evolution**:
- Add tenant isolation to existing Prisma schema
- Implement RBAC with NestJS Guards  
- Add audit logging middleware
- Introduce Redis for session management

**Frontend Evolution**:  
- Add tenant-aware routing
- Implement role-based UI components
- Add basic dashboard framework
- Introduce state management library (Redux Toolkit)

**Infrastructure**:
- Add Redis container to Docker Compose
- Implement proper logging aggregation
- Add health checks and monitoring
- Set up CI/CD pipeline

### Phase 2: Platform Foundation (6-12 months)
**Goal**: Build core CRM and basic e-learning features

**Backend Evolution**:
- Extract services from monolith (auth, tenant, user services)
- Add message queue (Redis Pub/Sub → RabbitMQ/Kafka)
- Implement GraphQL Federation
- Add file storage service (MinIO/S3)

**Frontend Evolution**:
- Migrate to micro-frontend architecture  
- Add real-time features (WebSocket/SSE)
- Implement advanced UI components
- Add mobile-responsive design

**New Services**:
- CRM service with lead/customer management
- Basic learning service (courses, enrollments)
- Notification service (email, SMS)
- Media processing service

### Phase 3: Full Platform (12-24 months)  
**Goal**: Complete feature set with advanced capabilities

**Services to Add**:
- Advanced e-learning (live classes, assessments)
- VoIP/communication service
- Payment processing service
- Social network service
- Analytics & reporting service

**Advanced Features**:
- AI-powered recommendations
- Advanced analytics & ML
- Mobile applications
- Third-party integrations

## Key Architectural Decisions

### Decision 1: GraphQL vs REST
- **Context**: API design for complex, evolving platform
- **Decision**: GraphQL with potential REST endpoints for webhooks
- **Rationale**: 
  - Client-driven data fetching reduces over-fetching
  - Strong typing with TypeScript integration
  - Single endpoint simplifies client architecture
  - Introspection supports rapid frontend development

### Decision 2: Monolith → Microservices Evolution
- **Context**: How to scale from MVP to enterprise platform
- **Decision**: Gradual extraction pattern ("Strangler Fig")
- **Rationale**:
  - Start simple, avoid premature optimization
  - Extract services when team/complexity justifies overhead
  - Maintain single deployment until scaling pressures emerge
  - Data consistency easier with shared database initially

### Decision 3: Multi-Tenant Data Isolation
- **Context**: B2B SaaS requires strong tenant separation
- **Decision**: Database-level isolation with shared schema
- **Rationale**:
  - Tenant ID in every table (Row-Level Security in PostgreSQL)
  - Shared infrastructure reduces operational complexity  
  - Can migrate to separate databases per tenant if needed
  - Prisma middleware can enforce tenant filtering

### Decision 4: TypeScript Everywhere
- **Context**: Type safety across full stack
- **Decision**: TypeScript for all application code
- **Rationale**:
  - Catches errors at compile time vs runtime
  - Excellent IDE support and refactoring
  - GraphQL code generation creates end-to-end typing
  - Team productivity increases with type safety

### Decision 5: Container-First Development
- **Context**: Development environment consistency
- **Decision**: Docker Compose for all environments
- **Rationale**:
  - Eliminates "works on my machine" problems
  - Production-like development environment  
  - Easy integration testing with real databases
  - Simple onboarding for new developers

## Development Patterns & Conventions

### Backend Patterns (NestJS)

#### Module Organization
```typescript
// Feature-based modules
src/
├── auth/
│   ├── auth.module.ts        # Feature module
│   ├── auth.service.ts       # Business logic
│   ├── auth.resolver.ts      # GraphQL endpoint
│   ├── auth.guard.ts         # Authorization logic
│   ├── dto/                  # Input/output types
│   └── __tests__/            # Unit tests
├── user/
├── tenant/
└── shared/
    ├── prisma/               # Database service
    ├── config/               # Configuration
    └── utils/                # Common utilities
```

#### GraphQL Code-First Pattern
```typescript
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;
  
  @Field()
  username: string;
  
  @Field({ nullable: true })
  name?: string;
}

@Resolver(() => User)
export class UserResolver {
  @Query(() => User)
  async getUser(@Args('id') id: string): Promise<User> {
    return this.userService.findById(id);
  }
}
```

#### Tenant-Aware Services
```typescript
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  
  async findById(id: string, tenantId: string): Promise<User> {
    return this.prisma.user.findFirst({
      where: { id, tenantId }, // Tenant isolation
    });
  }
}
```

### Frontend Patterns (React + TypeScript)

#### Component Organization
```
src/
├── components/
│   ├── auth/                 # Feature components
│   ├── common/               # Reusable components  
│   └── layout/               # Layout components
├── pages/                    # Route components
├── hooks/                    # Custom React hooks
├── context/                  # React Context providers
├── graphql/                  # GraphQL operations
├── types/                    # TypeScript definitions
└── utils/                    # Helper functions
```

#### GraphQL Integration Pattern
```typescript
// Generated types from GraphQL schema
import { useGetUserQuery } from '../generated/graphql';

function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useGetUserQuery({
    variables: { userId }
  });
  
  if (loading) return <Loading />;
  if (error) return <Error error={error} />;
  
  return <UserCard user={data.getUser} />;
}
```

#### Context + Hook Pattern
```typescript
// Context definition
interface AuthContextType {
  user: User | null;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// Custom hook for easy consumption
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Testing Strategy

### Current Testing (MVP)
- **Backend**: Unit tests with Jest, E2E tests with test database
- **Frontend**: Component tests with Vitest + Testing Library  
- **Integration**: Docker Compose test environment

### Future Testing Strategy
```
Testing Pyramid:

┌─────────────────────────────────┐
│         E2E Tests               │  ← Cypress/Playwright
│      (User workflows)           │
├─────────────────────────────────┤
│      Integration Tests          │  ← Service boundaries
│   (API contracts, databases)    │
├─────────────────────────────────┤
│        Unit Tests               │  ← Business logic
│  (Services, components, utils)  │
└─────────────────────────────────┘

Contract Testing:
- GraphQL schema validation
- API contract tests between services
- Database migration tests

Performance Testing:  
- Load testing with k6
- Database performance profiling
- Frontend bundle analysis
```

## Security Architecture

### Current Security (MVP)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Data Separation**: Credentials isolated from profile data
- **Validation**: Input validation with class-validator
- **CORS**: Configured for development origins

### Enhanced Security Roadmap
```
Security Layers:

Application Layer:
├── Authentication (OAuth2, 2FA, SSO)
├── Authorization (RBAC, resource-based permissions)  
├── Input Validation (sanitization, type checking)
└── Rate Limiting (per-user, per-tenant quotas)

Network Layer:
├── TLS/HTTPS (certificate management)
├── API Gateway (request filtering)
├── VPN Access (admin/development access)
└── DDoS Protection (Cloudflare, AWS Shield)

Data Layer:
├── Encryption at Rest (database, file storage)
├── Encryption in Transit (all API calls)
├── Data Masking (logs, exports)
└── Backup Encryption (automated backups)

Compliance:
├── GDPR (data privacy, right to deletion)
├── SOC 2 (security controls)
├── HIPAA (healthcare data, if applicable)
└── Audit Logging (all user actions)
```

## Performance & Scalability

### Current Performance Profile
- **Database**: Single PostgreSQL instance, connection pooling via Prisma
- **Frontend**: Vite dev server (dev), Nginx static serving (prod)
- **Caching**: Browser caching only
- **Monitoring**: Basic Docker Compose health checks

### Scalability Strategy
```
Scaling Dimensions:

Vertical Scaling (0-1000 users):
├── Upgrade server resources
├── Optimize database queries  
├── Add Redis caching layer
└── Implement connection pooling

Horizontal Scaling (1K-10K users):
├── Load balancer (nginx, HAProxy)
├── Read replicas for database
├── CDN for static assets  
├── Microservice extraction (auth, notifications)
└── Session store (Redis cluster)

Enterprise Scaling (10K+ users):
├── Database sharding/partitioning
├── Message queue (RabbitMQ/Kafka) 
├── Search engine (Elasticsearch)
├── Monitoring (Prometheus, Grafana)
├── Auto-scaling (Kubernetes)
└── Multi-region deployment
```

### Performance Monitoring Strategy
```
Observability Stack:

Metrics:
├── Application metrics (response times, error rates)
├── Infrastructure metrics (CPU, memory, disk)
├── Database metrics (query performance, connections)
└── Business metrics (user engagement, revenue)

Logging:  
├── Structured logging (JSON format)
├── Centralized logging (ELK stack)
├── Log levels and filtering
└── Error tracking (Sentry)

Tracing:
├── Distributed tracing (OpenTelemetry)
├── Database query tracing  
├── External API call tracing
└── Performance bottleneck identification
```

## Deployment & DevOps

### Current Deployment (MVP)
- **Development**: Docker Compose with hot reload
- **Production**: Manual Docker Compose deployment
- **Database**: Local PostgreSQL container
- **Assets**: Nginx serving static files

### Target DevOps Pipeline
```
CI/CD Pipeline:

Development:
├── Feature branch creation
├── Automated testing (unit, integration)
├── Code quality checks (ESLint, Prettier)  
├── Security scanning (Snyk, SonarQube)
└── Preview deployment (review apps)

Staging:
├── Integration tests with real services
├── Performance testing
├── Security testing  
├── User acceptance testing
└── Database migration validation

Production:
├── Blue-green deployment
├── Database migration (zero-downtime)
├── Health checks and rollback capability
├── Monitoring and alerting
└── Post-deployment verification

Infrastructure as Code:
├── Terraform for cloud resources
├── Docker containers for applications
├── Kubernetes manifests for orchestration  
└── Environment configuration management
```

## Migration Strategy

### Phase 1: MVP Stabilization (Months 1-2)
```bash
# Current MVP enhancements
1. Add comprehensive test coverage
2. Implement proper error handling  
3. Add request/response logging
4. Set up monitoring dashboard
5. Create backup & recovery procedures
```

### Phase 2: Multi-Tenant Foundation (Months 3-6)  
```bash
# Database schema evolution
1. Add tenant_id to all tables
2. Implement Row-Level Security (RLS)
3. Create tenant management API
4. Add tenant-aware middleware
5. Migrate existing users to default tenant
```

### Phase 3: Service Extraction (Months 6-12)
```bash  
# Gradual microservice extraction
1. Extract authentication service
2. Extract user management service  
3. Add API gateway (GraphQL Federation)
4. Implement service discovery
5. Add inter-service communication (events)
```

## Conclusion

The Meowingful App architecture is designed for sustainable growth from a simple MVP to a comprehensive multi-tenant platform. Key principles:

1. **Start Simple**: Current MVP provides solid foundation
2. **Evolve Gradually**: Avoid big-bang rewrites; extract complexity incrementally  
3. **Type Safety**: TypeScript everywhere reduces bugs and improves maintainability
4. **Security First**: Tenant isolation and credential protection built-in from day one
5. **Developer Experience**: Docker Compose, hot reload, and comprehensive tooling  
6. **Future-Proof**: Architecture decisions support scaling to enterprise requirements

The modular approach ensures each phase delivers value while building toward the full platform vision. Technology choices prioritize developer productivity and operational simplicity while maintaining the flexibility to scale when business requirements demand it.