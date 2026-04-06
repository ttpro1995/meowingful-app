# Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

# Install dependencies including dotenv for prisma config
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dotenv for Prisma config
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (needed for prisma CLI)
RUN npm ci

# Generate Prisma client for production
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE 3000

# Run database migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
