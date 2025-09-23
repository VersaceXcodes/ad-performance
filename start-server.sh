#!/bin/bash

# Start server script with proper error handling
set -e

echo "Starting PulseDeck Application..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Build frontend if not already built
if [ ! -f "/app/backend/public/index.html" ]; then
    echo "Building frontend..."
    cd /app/vitereact
    npm run build
    cp -r dist/* /app/backend/public/
fi

# Build backend if not already built
if [ ! -d "/app/backend/dist" ]; then
    echo "Building backend..."
    cd /app/backend
    npm run build
fi

# Start the server
echo "Starting backend server..."
cd /app/backend
exec npm start