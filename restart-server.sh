#!/bin/bash

# Restart script for the backend server
# This ensures a clean restart with proper error handling

set -e

echo "🔄 Restarting backend server..."

# Kill existing server processes
pkill -f "node.*server.js" || true
pkill -f "tsx.*server.ts" || true

# Wait a moment for processes to clean up
sleep 2

# Navigate to backend directory
cd /app/backend

echo "📦 Installing/updating dependencies..."
npm install

echo "🏗️ Building server..."
npm run build

echo "🚀 Starting server..."
npm start &

# Wait for server to start up
echo "⏳ Waiting for server to be ready..."
sleep 5

# Test if server is responding
echo "🧪 Testing server connectivity..."
for i in {1..10}; do
    if curl -f -s -H "Accept: application/json" http://localhost:3000/health > /dev/null; then
        echo "✅ Server is ready and responding!"
        exit 0
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 2
done

echo "❌ Server failed to start properly"
exit 1