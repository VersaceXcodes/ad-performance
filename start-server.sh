#!/bin/bash

# Start server script with proper error handling and health checks
set -e

echo "🚀 Starting PulseDeck Application..."

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use"
        echo "Killing existing process..."
        pkill -f "node.*server" || true
        sleep 2
    fi
}

# Function to wait for server to be ready
wait_for_server() {
    local port=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for server to start on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            echo "✅ Server is ready!"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts - Server not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Server failed to start within timeout"
    return 1
}

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-3000}

echo "📋 Environment Configuration:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  DATABASE_URL: ${DATABASE_URL:0:30}..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Check if port is available
check_port $PORT

# Build frontend if not already built
if [ ! -f "/app/backend/public/index.html" ]; then
    echo "🔨 Building frontend..."
    cd /app/vitereact
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    npm run build
    
    # Copy built files to backend public directory
    mkdir -p /app/backend/public
    cp -r dist/* /app/backend/public/
    echo "✅ Frontend built and copied to backend/public"
else
    echo "✅ Frontend already built"
fi

# Build backend if not already built
if [ ! -d "/app/backend/dist" ]; then
    echo "🔨 Building backend..."
    cd /app/backend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    fi
    
    npm run build
    echo "✅ Backend built"
else
    echo "✅ Backend already built"
fi

# Test database connection before starting server
echo "🔍 Testing database connection..."
cd /app/backend
if node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.connect()
  .then(client => { console.log('✅ Database connection successful'); client.release(); process.exit(0); })
  .catch(err => { console.error('❌ Database connection failed:', err.message); process.exit(1); });
"; then
    echo "✅ Database connection verified"
else
    echo "❌ Database connection failed - server may not start properly"
fi

# Start the server
echo "🚀 Starting backend server on port $PORT..."
cd /app/backend

# Start server in background to test connectivity
node dist/server.js &
SERVER_PID=$!

# Wait for server to be ready
if wait_for_server $PORT; then
    echo "🎉 Server started successfully!"
    echo "📊 Health check: http://localhost:$PORT/health"
    echo "🔗 API status: http://localhost:$PORT/api/status"
    echo "🌐 Frontend: http://localhost:$PORT/"
    
    # Bring server to foreground
    wait $SERVER_PID
else
    echo "❌ Server startup failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi