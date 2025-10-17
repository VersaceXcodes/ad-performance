#!/bin/bash

echo "Testing Campaigns Endpoint Fix"
echo "================================"
echo

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"john.doe@example.com","password":"password123"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "✅ Authentication successful"
echo

# Test different sort parameters
SORT_PARAMS=(
  "created_at:desc"
  "spend:desc"
  "impressions:desc"
  "clicks:asc"
  "conversions:desc"
  "ctr:desc"
  "cpm:asc"
  "cpc:asc"
  "cpa:asc"
  "roas:desc"
)

echo "Testing various sort parameters:"
echo "--------------------------------"

for param in "${SORT_PARAMS[@]}"; do
  IFS=':' read -r sort_by sort_order <<< "$param"
  
  result=$(curl -s -X GET "http://localhost:3000/api/workspaces/workspace_001/campaigns?sort_by=$sort_by&sort_order=$sort_order" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'data' in data:
        print('✅')
    else:
        print(f\"❌ Error: {data.get('message', 'Unknown')}\"[:50])
except Exception as e:
    print(f\"❌ Parse error: {str(e)}\"[:50])
" 2>&1)
  
  echo "  sort_by=$sort_by, sort_order=$sort_order: $result"
done

echo
echo "Testing campaign list retrieval:"
echo "--------------------------------"

campaigns=$(curl -s -X GET "http://localhost:3000/api/workspaces/workspace_001/campaigns" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'data' in data:
    print(f\"Found {len(data['data'])} campaigns\")
    for c in data['data'][:3]:
        print(f\"  - {c['campaign_name']}: Spend=\${c['spend']}, ROAS={c['roas']}\")
else:
    print(f\"Error: {data.get('message', 'Unknown')}\")
" 2>&1)

echo "$campaigns"
echo

echo "All tests completed!"
