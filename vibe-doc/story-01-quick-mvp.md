
# Story: User Authentication and Profile MVP

## Metadata
- **Story ID**: STORY-001
- **Priority**: High
- **Status**: Draft
- **Created**: 2026-03-29T00:00:00Z
- **Updated**: 2026-03-29T00:00:00Z
- **Author**: AI Assistant
- **Related**: 
   - vibe-doc/instruction.md

## User Story
As a new user, I want to register, log in with a username and password, and manage my profile (name, bio, password) so that I can securely access and personalize my account.

## Context
This is the first MVP for the app. It provides basic user authentication and profile management. Security best practices must be followed, especially for password storage. The backend and frontend must be containerized and orchestrated with Docker Compose.

## Requirements

### Functional Requirements
- [ ] User can register with username and password
- [ ] User can log in with username and password
- [ ] User can view and edit their display name and bio
- [ ] User can change their password
- [ ] Username is immutable after registration
- [ ] Login credentials are stored in a secure, separate table from profile info

### Non-Functional Requirements
- [ ] Passwords are hashed and salted using best practices
- [ ] Backend and frontend run in separate containers
- [ ] Services are connected via Docker Compose
- [ ] Secure communication between frontend and backend

## Acceptance Criteria
- [ ] Registration, login, and profile update flows work end-to-end
- [ ] Passwords are never stored in plaintext
- [ ] Username cannot be changed after registration
- [ ] User can update display name, bio, and password
- [ ] All services run and communicate via Docker Compose

## Technical Specifications

### Architecture Impact
- **Frontend**: Webapp for registration, login, and profile management
- **Backend**: NestJS with GraphQL, Prisma ORM, PostgreSQL
- **Containers**: Separate Docker containers for frontend and backend, orchestrated with Docker Compose

### Data Structures

**User Table (Profile):**
- id (UUID)
- username (string, unique, immutable)
- name (string, editable)
- bio (string, editable)

**Auth Table:**
- id (UUID, FK to user)
- username (string, unique)
- password_hash (string)
- salt (string)

### API Changes
- GraphQL mutations/queries for register, login, getUser, updateUser, changePassword

## Implementation Plan

### Step 1: Backend Setup
**Objective**: Scaffold NestJS backend with GraphQL, Prisma, and PostgreSQL

**Tasks**:
- [ ] Initialize NestJS project
- [ ] Set up GraphQL and Prisma
- [ ] Define User and Auth models in Prisma schema
- [ ] Implement resolvers for registration, login, profile, and password change

**Validation**:
- [ ] Backend runs and exposes GraphQL API

### Step 2: Frontend Setup
**Objective**: Scaffold frontend webapp

**Tasks**:
- [ ] Initialize frontend project (React or similar)
- [ ] Implement registration, login, and profile pages
- [ ] Connect to backend GraphQL API

**Validation**:
- [ ] Frontend can call backend and display forms

### Step 3: Secure Auth Implementation
**Objective**: Implement secure password storage and authentication

**Tasks**:
- [ ] Use bcrypt or argon2 for password hashing and salting
- [ ] Store login info in separate table from profile
- [ ] Enforce username immutability

**Validation**:
- [ ] Passwords are hashed and salted in DB
- [ ] Username cannot be changed

### Step 4: Containerization
**Objective**: Containerize frontend and backend, orchestrate with Docker Compose

**Tasks**:
- [ ] Write Dockerfiles for frontend and backend
- [ ] Write docker-compose.yml to connect services and database

**Validation**:
- [ ] All services start and communicate via Docker Compose

## Testing Strategy

### Unit Tests
- [ ] Test registration, login, and profile update logic
- [ ] Test password hashing and verification

### Integration Tests
- [ ] Test end-to-end registration and login
- [ ] Test profile update and password change

### Manual Testing
- [ ] Register, log in, and update profile via UI
- [ ] Attempt to change username (should fail)
- [ ] Verify passwords are not stored in plaintext

## Dependencies

### Prerequisites
- [ ] Docker and Docker Compose installed
- [ ] Node.js and npm/yarn

### Blocked By
- None

### Blocks
- Future user features

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Password storage vulnerability | High | Low | Use proven libraries, review code |
| Container networking issues | Medium | Medium | Test Compose setup early |
| Username collision | Medium | Low | Enforce unique constraint in DB |

## Design Decisions

### Decision 1: Separate Auth Table
- **Context**: Security best practice to separate credentials from profile
- **Options Considered**:
   1. Store all user info in one table
   2. Separate tables for auth and profile
- **Decision**: Use separate tables
- **Rationale**: Limits exposure of sensitive data

### Decision 2: Password Hashing Algorithm
- **Context**: Need secure password storage
- **Options Considered**:
   1. bcrypt
   2. argon2
- **Decision**: Use bcrypt (or argon2 if available)
- **Rationale**: Both are industry standards

## Examples

### Code Examples

**Prisma Schema:**
```prisma
model User {
   id        String   @id @default(uuid())
   username  String   @unique
   name      String
   bio       String?
   auth      Auth
}

model Auth {
   id           String   @id @default(uuid())
   userId       String   @unique
   username     String   @unique
   passwordHash String
   salt         String
   user         User     @relation(fields: [userId], references: [id])
}
```

**GraphQL Mutation Example:**
```graphql
mutation Register($username: String!, $password: String!, $name: String!) {
   register(username: $username, password: $password, name: $name) {
      id
      username
      name
   }
}
```

## Documentation Updates

- [ ] Update README.md with setup and usage instructions
- [ ] Document API endpoints and schema
- [ ] Add work-log entry for MVP

## Completion Checklist

- [ ] All functional requirements implemented
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Code reviewed (if applicable)
- [ ] Work-log entry created

## Notes

- Use environment variables for secrets in Docker
- Consider HTTPS for production

## References

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [bcrypt npm](https://www.npmjs.com/package/bcrypt)
- [Docker Compose Docs](https://docs.docker.com/compose/)