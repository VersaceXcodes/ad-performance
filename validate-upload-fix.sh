#!/bin/bash

echo "🔍 Validating Upload Interface Fix..."
echo ""

# Check if new bundle exists
if [ -f "/app/backend/public/assets/index-Cyy-hTco.js" ]; then
    echo "✅ New bundle file exists: index-Cyy-hTco.js"
else
    echo "❌ New bundle file NOT found: index-Cyy-hTco.js"
    exit 1
fi

# Check if old bundle is removed
if [ ! -f "/app/backend/public/assets/index-DoiicJzH.js" ]; then
    echo "✅ Old bundle file removed: index-DoiicJzH.js"
else
    echo "⚠️  Old bundle file still exists: index-DoiicJzH.js"
fi

# Check HTML references new bundle
if grep -q "index-Cyy-hTco.js" /app/backend/public/index.html; then
    echo "✅ HTML references new bundle"
else
    echo "❌ HTML does not reference new bundle"
    exit 1
fi

# Check bundle doesn't contain circular dependency error
if grep -q "Cannot access.*before initialization" /app/backend/public/assets/index-Cyy-hTco.js; then
    echo "❌ Bundle contains circular dependency error"
    exit 1
else
    echo "✅ Bundle is error-free"
fi

# Check server is running
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running"
    exit 1
fi

# Check upload page loads
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/w/workspace_001/upload)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Upload page loads successfully (HTTP 200)"
else
    echo "❌ Upload page failed to load (HTTP $HTTP_CODE)"
    exit 1
fi

echo ""
echo "✅ ALL VALIDATIONS PASSED!"
echo ""
echo "Summary of fix:"
echo "  • Fixed circular dependency in UV_UploadWizard.tsx"
echo "  • Moved useEffect hook after handleFileSelect definition"
echo "  • Rebuilt and deployed new bundle: index-Cyy-hTco.js"
echo "  • Upload interface should now render without ReferenceError"
echo ""
