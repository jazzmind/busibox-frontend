# =============================================================================
# Busibox Portal - Production Dockerfile
# =============================================================================
# Multi-stage build for Next.js application.
# Used by the Busibox K8s in-cluster build server.
#
# Build args:
#   GITHUB_AUTH_TOKEN - GitHub token for @jazzmind npm packages
#   NEXT_PUBLIC_BASE_PATH - Base path for nginx proxying (e.g., /portal)
# =============================================================================

# --- Stage 1: Install dependencies ---
FROM node:20-slim AS deps
WORKDIR /app

# Accept GitHub auth token for private npm packages
ARG GITHUB_AUTH_TOKEN
ENV GITHUB_AUTH_TOKEN=${GITHUB_AUTH_TOKEN}

# Copy package files
COPY package.json package-lock.json* .npmrc ./

# Install dependencies
RUN npm ci --legacy-peer-deps --include=dev

# --- Stage 2: Build ---
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build-time env vars
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_BUSIBOX_PORTAL_URL=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_PUBLIC_BUSIBOX_PORTAL_URL=${NEXT_PUBLIC_BUSIBOX_PORTAL_URL}
ENV NODE_ENV=production

# Generate Prisma client if schema exists
RUN if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi

# Build the application
RUN npm run build

# --- Stage 3: Production runtime ---
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install runtime-only system deps (if any needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output (includes only traced dependencies)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prisma schema if it exists (needed at runtime for client)
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
