# Build Stage
FROM node:24-alpine AS builder
WORKDIR /app


# 🛡️ FIX: Copy package files AND the local vendor folder before installing dependencies
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci


# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# Production Stage
FROM node:24-alpine
WORKDIR /app


# 🛡️ FIX: Copy package files AND the local vendor folder for the production install
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev


# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist


# Expose the port Railway/Docker will use
EXPOSE 3000


# Start the application
CMD ["node", "dist/server.js"]


