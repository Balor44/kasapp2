# Build Stage
FROM node:24-alpine AS builder
WORKDIR /app


# Copy package files and vendor directory
COPY package*.json ./
COPY vendor ./vendor


# Use npm install to bypass strict lockfile tarball hashes
RUN npm install


# Copy source code, config, and the Argent covenants!
COPY tsconfig.json ./
COPY contracts ./contracts
COPY src ./src
RUN npm run build


# Production Stage
FROM node:24-alpine
WORKDIR /app


# Copy package files and vendor directory
COPY package*.json ./
COPY vendor ./vendor


# Use npm install for production deps
RUN npm install --omit=dev


# Copy built artifacts AND the covenant artifacts from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/contracts ./contracts


# Expose the port Railway/Docker will use
EXPOSE 3000


# Start the application
CMD ["node", "dist/server.js"]


