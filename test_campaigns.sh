#!/bin/bash
echo "Testing campaigns endpoint as the browser does..."

# Login
echo "1. Logging in..."
TOKEN=$(curl -s -X POST https://123ad-performance.launchpulse.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@example.com","password":"password123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get token"
  exit 1
fi
echo "✓ Login successful"

# Test the exact endpoint the browser was calling
echo ""
echo "2. Fetching campaigns with spend sort (the failing request)..."
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/campaigns?page=1&per_page=50&sort_by=spend&sort_order=desc")

# Check if response contains error
if echo "$RESPONSE" | grep -q '"success":false'; then
  echo "ERROR: Request failed"
  echo "$RESPONSE" | python3 -m json.tool
  exit 1
fi

# Check if we got data
DATA_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['data']))")
echo "✓ Successfully fetched $DATA_COUNT campaigns"

# Show a sample campaign with metrics
echo ""
echo "3. Sample campaign data:"
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['data']:
    c = data['data'][0]
    print(f\"  Campaign: {c['campaign_name']}\")
    print(f\"  Platform: {c['platform']}\")
    print(f\"  Spend: \${c['spend']}\")
    print(f\"  Revenue: \${c['revenue']}\")
    print(f\"  ROAS: {c['roas']}\")
    print(f\"  Impressions: {c['impressions']}\")
    print(f\"  Clicks: {c['clicks']}\")
"

echo ""
echo "✅ All tests passed! The campaigns endpoint is working correctly."
