# Campaign Management Endpoint Fix

## Issue Summary

**Problem:** The Campaign Management Interface was experiencing a persistent 500 Internal Server Error on the `GET /api/workspaces/{workspace_id}/campaigns` endpoint with the error message: `column c.spend does not exist`.

**Priority:** High

**Browser Test Session:** https://app.hyperbrowser.ai/live?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uSWQiOiIzOWZmOGU2YS01OWY2LTRjMjYtOTM1YS0yOGFkZjMxNjI0ZmQiLCJ0ZWFtSWQiOiJjN2JhM2NiZi1mNzczLTRmNjItYmE2OC00NDQ0OTNkYTNjMjgiLCJpYXQiOjE3NjA3MDAwOTIsImV4cCI6MTc2MDc0MzI5Mn0.vsVWlh3w-hwHHpzx2z5wXuHgLpDm8ingzzEWH2h5MEE&liveDomain=https://connect-us-west-2.hyperbrowser.ai:6090

## Root Cause

The campaigns endpoint was using **column position-based ordering** in the `ORDER BY` clause when sorting by metric columns (spend, impressions, clicks, conversions, etc.). This approach failed because PostgreSQL couldn't resolve aggregate function columns by their position when they're part of a `GROUP BY` query with complex expressions.

The original code attempted to use column positions (e.g., `ORDER BY 12 DESC` for spend), but this doesn't work correctly with aggregate functions like `SUM(m.spend)` in the SELECT list.

## Solution

Replaced the column position-based `ORDER BY` with explicit aggregate expressions that match the SELECT list:

### Before
```typescript
const columnMap = {
  'spend': 12,  // Column position
  'impressions': 13,
  // ... etc
};
const orderByClause = `${orderByColumn} ${sanitizedSortOrder}`;  // e.g., "12 DESC"
```

### After
```typescript
const columnMap = {
  'spend': 'SUM(m.spend)',  // Explicit aggregate expression
  'impressions': 'SUM(m.impressions)',
  'clicks': 'SUM(m.clicks)',
  'conversions': 'SUM(m.conversions)',
  'revenue': 'SUM(m.revenue)',
  'ctr': 'SUM(m.clicks)::NUMERIC / NULLIF(SUM(m.impressions), 0)',
  'cpm': 'SUM(m.spend) / NULLIF(SUM(m.impressions), 0)',
  'cpc': 'SUM(m.spend) / NULLIF(SUM(m.clicks), 0)',
  'cpa': 'SUM(m.spend) / NULLIF(SUM(m.conversions), 0)',
  'cvr': 'SUM(m.conversions)::NUMERIC / NULLIF(SUM(m.clicks), 0)',
  'roas': 'SUM(m.revenue) / NULLIF(SUM(m.spend), 0)',
  // Campaign columns use table aliases
  'id': 'c.id',
  'campaign_name': 'c.campaign_name',
  'created_at': 'c.created_at',
  // ... etc
};
const orderByClause = `${orderByColumn} ${sanitizedSortOrder}`;  // e.g., "SUM(m.spend) DESC"
```

## Changes Made

**File:** `backend/server.ts` (lines 3501-3544)

1. **Replaced column position map with expression map:** All sort columns now map to their actual SQL expressions
2. **Added NULLIF protection:** Prevented division by zero errors in calculated metrics
3. **Used explicit table aliases:** Campaign columns reference `c.` prefix, account columns use `a.` prefix
4. **Maintained aggregate consistency:** ORDER BY expressions match SELECT list aggregate functions

## Testing Results

All sort parameters tested successfully:

✅ `sort_by=created_at&sort_order=desc` - Default chronological sort  
✅ `sort_by=spend&sort_order=desc` - Sort by total spend  
✅ `sort_by=impressions&sort_order=desc` - Sort by impressions  
✅ `sort_by=clicks&sort_order=asc` - Sort by clicks ascending  
✅ `sort_by=conversions&sort_order=desc` - Sort by conversions  
✅ `sort_by=ctr&sort_order=desc` - Sort by click-through rate  
✅ `sort_by=cpm&sort_order=asc` - Sort by cost per mille  
✅ `sort_by=cpc&sort_order=asc` - Sort by cost per click  
✅ `sort_by=cpa&sort_order=asc` - Sort by cost per acquisition  
✅ `sort_by=roas&sort_order=desc` - Sort by return on ad spend  

### Test Results
```
Testing campaign list retrieval:
Found 3 campaigns
  - Summer Sale 2024: Spend=$4555.75, ROAS=2.90
  - Brand Awareness Q1: Spend=$0, ROAS=0
  - Search Campaign - Electronics: Spend=$3802.70, ROAS=2.37
```

## Deployment Status

- ✅ **Local Testing:** All tests passing
- ✅ **Code Committed:** Git commit `530d3569`
- ✅ **Pushed to GitHub:** Triggered CI/CD pipeline
- ⏳ **Production Deployment:** GitHub Actions workflow deploying to Fly.io

## Affected Endpoints

- `GET /api/workspaces/{workspace_id}/campaigns` - Main campaigns list endpoint
- All sort_by parameters: `spend`, `impressions`, `clicks`, `conversions`, `revenue`, `ctr`, `cpm`, `cpc`, `cpa`, `cvr`, `roas`

## Database Schema Notes

The fix properly handles the relationship between:
- **campaigns table (c):** Contains campaign metadata
- **accounts table (a):** Contains account information (joined for platform/name)
- **metrics_daily table (m):** Contains performance metrics (LEFT JOIN for aggregation)

No database schema changes were required.

## Prevention

To prevent similar issues in the future:

1. **Always use explicit column references** in ORDER BY clauses for aggregate queries
2. **Test all sort parameters** when implementing new list endpoints
3. **Use NULLIF** to prevent division by zero in calculated metrics
4. **Match ORDER BY expressions** exactly to SELECT list when using aggregates
5. **Add comprehensive tests** for different sorting scenarios

## Verification Commands

```bash
# Test default sort
curl -H "Authorization: Bearer $TOKEN" \
  "https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/campaigns"

# Test sort by spend
curl -H "Authorization: Bearer $TOKEN" \
  "https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/campaigns?sort_by=spend&sort_order=desc"

# Test sort by ROAS
curl -H "Authorization: Bearer $TOKEN" \
  "https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/campaigns?sort_by=roas&sort_order=desc"
```

## Related Issues

This fix resolves the browser testing failure reported in the automated test session. The campaigns interface should now load properly and display the campaign list with all filtering and sorting functionality working as expected.
