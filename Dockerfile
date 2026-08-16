ARG NODE_VERSION=22

############################################
# Base
############################################
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat

############################################
# Dependencies
############################################
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

############################################
# Development
############################################
FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3333
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

############################################
# Test
############################################
FROM deps AS test
ENV NODE_ENV=test
COPY . .
CMD ["npm", "test"]

############################################
# Build
############################################
FROM deps AS build
ENV NODE_ENV=production \
    APP_KEY=buildtimeappkeyforbetawork12345 \
    HOST=0.0.0.0 \
    PORT=3333 \
    LOG_LEVEL=info \
    DB_HOST=127.0.0.1 \
    DB_PORT=5432 \
    DB_USER=betawork \
    DB_PASSWORD=betawork \
    DB_DATABASE=betawork \
    REDIS_HOST=127.0.0.1 \
    REDIS_PORT=6379
COPY . .
RUN node ace build \
  && mkdir -p build/storage/uploads/artisans \
  && cd build && npm ci --omit=dev

############################################
# Production
############################################
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/build ./
RUN mkdir -p storage/uploads/artisans \
  && chown -R node:node /app
USER node
EXPOSE 3333
CMD ["sh", "-c", "node ace.js migration:run --force && node bin/server.js"]
