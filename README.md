# Meowingful App

A full-stack web application with user authentication and profile management.

## Tech Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **GraphQL** - Query language for APIs
- **Prisma** - Next-generation ORM
- **PostgreSQL** - Relational database
- **bcryptjs** - Password hashing

### Frontend
- **React** - UI library
- **TypeScript** - Type safety
- **Apollo Client** - GraphQL client
- **React Router** - Navigation
- **Vite** - Build tool

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Service orchestration
- **Nginx** - Web server (frontend)

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20+ (for local development)

### Running with Docker (Recommended)

1. **Start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend GraphQL Playground: http://localhost:3000/graphql
   - PostgreSQL: localhost:5432

3. **Stop services:**
   ```bash
   docker-compose down
   ```

### Local Development

#### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd back-end
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # .env file (already configured)
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meowingful?schema=public"
   ```

4. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   ```

6. **Start the backend:**
   ```bash
   npm run start:dev
   ```

#### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd front-end
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # .env file
   VITE_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
   ```

4. **Start the frontend:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Frontend: http://localhost:5173

#### Development with Docker Compose

For hot-reload development with Docker:

```bash
docker-compose -f docker-compose.dev.yml up
```

## Features

### User Authentication
- User registration with username and password
- User login with credentials
- Secure password hashing with bcrypt

### Profile Management
- View and edit display name
- View and edit bio
- Change password
- Username is immutable after registration

## API Schema

### Mutations

```graphql
# Register a new user
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user {
      id
      username
      name
      bio
    }
  }
}

# Login
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

# Update user profile
mutation UpdateUser($userId: String!, $input: UpdateUserInput!) {
  updateUser(userId: $userId, input: $input) {
    id
    username
    name
    bio
  }
}

# Change password
mutation ChangePassword($userId: String!, $input: ChangePasswordInput!) {
  changePassword(userId: $userId, input: $input)
}
```

### Queries

```graphql
# Get user by ID
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
```

## Database Schema

### User Table (Profile)
- `id` (UUID) - Primary key
- `username` (String) - Unique, immutable
- `name` (String) - Display name, editable
- `bio` (String, optional) - User bio, editable
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Auth Table (Credentials)
- `id` (UUID) - Primary key
- `userId` (UUID) - Foreign key to User
- `username` (String) - Unique
- `passwordHash` (String) - Hashed password
- `salt` (String) - Password salt
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

## Testing

### Backend Tests

```bash
cd back-end

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test with coverage
npm run test:cov
```

### Frontend Tests

```bash
cd front-end

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run
```

## Project Structure

```
meowingful-app/
├── back-end/
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.resolver.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.service.spec.ts
│   │   │   └── auth.types.ts
│   │   ├── prisma/         # Prisma service
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── test/
│   │   └── auth.e2e-spec.ts
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── package.json
├── front-end/
│   ├── src/
│   │   ├── context/        # React context
│   │   │   └── AuthContext.tsx
│   │   ├── graphql/        # GraphQL queries
│   │   │   ├── client.ts
│   │   │   └── queries.ts
│   │   ├── pages/          # Page components
│   │   │   ├── Register.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Register.test.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

## Security Considerations

- Passwords are hashed and salted using bcryptjs
- Auth credentials are stored in a separate table from profile information
- Username is immutable to prevent security issues
- CORS is configured to allow only specific origins
- In production, use HTTPS and JWT tokens

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Backend server port (default: 3000)

### Frontend
- `VITE_GRAPHQL_ENDPOINT` - GraphQL API endpoint

## License

UNLICENSED

## Contributing

This is a hobby project. Feel free to fork and modify as needed.
