# Build Stage
FROM node:24-alpine AS builder
WORKDIR /app


# Copy package files and install all dependencies (including devDependencies for TS)
COPY package*.json ./
RUN npm ci


# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# Production Stage
FROM node:24-alpine
WORKDIR /app


# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev


# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist


# Expose the port Railway/Docker will use
EXPOSE 3000


# Start the application
CMD ["node", "dist/server.js"]


