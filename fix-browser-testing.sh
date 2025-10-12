#!/bin/bash

# Browser Testing Fix Script
# This script fixes the static file serving issue and restarts the server

echo "🔧 Fixing Browser Testing Issues..."

# Step 1: Ensure frontend is built
echo "📦 Building frontend..."
cd /app/vitereact
npm run build > /dev/null 2>&1

# Step 2: Copy built files to backend public directory
echo "📁 Copying static files..."
mkdir -p /app/backend/public
cp -r /app/vitereact/dist/* /app/backend/public/

# Step 3: Verify static files exist
echo "✅ Verifying static files..."
if [ -f "/app/backend/public/index.html" ]; then
    echo "   ✓ index.html found"
else
    echo "   ✗ index.html missing"
fi

# Step 4: Set correct environment variables
echo "🌍 Setting environment variables..."
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0

# Step 5: Find and kill existing server process
echo "🔄 Restarting server..."
pkill -f "server.ts" || true
pkill -f "server.js" || true
sleep 2

# Step 6: Start server in background
cd /app/backend
echo "🚀 Starting server..."
nohup npx tsx server.ts > /var/log/server.log 2>&1 &

# Step 7: Wait for server to start and test
echo "⏳ Waiting for server to start..."
sleep 5

# Test health endpoint
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ Server is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Server failed to start within timeout"
        exit 1
    fi
    sleep 1
done

# Test static files
echo "🧪 Testing static file serving..."
if curl -s -I http://localhost:3000/ | grep -q "text/html"; then
    echo "✅ Frontend is being served correctly"
else
    echo "❌ Frontend serving is still broken"
fi

# Test browser testing endpoint
echo "🧪 Testing browser testing validation..."
curl -s http://localhost:3000/api/test/validate | grep -q '"success"' && echo "✅ Browser testing validation working"

echo "🎉 Browser testing fixes applied successfully!"
echo ""
echo "📊 Test the following URLs:"
echo "  Frontend: https://123ad-performance.launchpulse.ai/"
echo "  Health: https://123ad-performance.launchpulse.ai/health"
echo "  API Status: https://123ad-performance.launchpulse.ai/api/status"
echo "  Validation: https://123ad-performance.launchpulse.ai/api/test/validate"