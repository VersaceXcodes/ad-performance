# Stage 1: Build the Vite React frontend
FROM node:18 AS frontend-build
WORKDIR /app/vitereact
# Copy package files and install dependencies with --legacy-peer-deps
COPY vitereact/package.json vitereact/package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-optional
# Copy the rest of the frontend files and build
COPY vitereact ./
# Clear any existing build artifacts to force fresh build
RUN rm -rf dist/ node_modules/.vite/
RUN npm run build

# Stage 2: Set up the Node.js backend
FROM node:18
WORKDIR /app

# Set environment variables early
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Copy package files and install dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm ci --only=production --no-optional

# Copy the backend files
COPY backend ./

# Build backend TypeScript
RUN npm run build

# Copy the frontend build output to backend/public
COPY --from=frontend-build /app/vitereact/dist /app/backend/public

# Create necessary directories and set permissions
RUN mkdir -p /app/backend/storage /app/backend/logs && \
    chown -R node:node /app/backend && \
    chmod 755 /app/backend/public

# Expose the port
EXPOSE 3000

# Switch to non-root user for security
USER node

# Health check for better deployment management
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Command to start the server with proper error handling
CMD ["sh", "-c", "node initdb.js && node dist/server.js"]