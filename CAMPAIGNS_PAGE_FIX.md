# Campaigns Page Rendering Fix

## Issue
The Campaigns page (`/w/workspace_001/campaigns`) was showing a blank page with the following error in the console:

```
TypeError: Cannot read properties of undefined (reading 'spend')
```

## Root Cause
The frontend component (`UV_Campaigns.tsx`) was expecting campaign metrics to be nested under a `metrics` property:

```typescript
campaign.metrics.spend
campaign.metrics.impressions
// etc.
```

However, the backend API returns campaigns with metrics as direct properties on the campaign object:

```json
{
  "id": "campaign_001",
  "campaign_name": "Summer Sale 2024",
  "spend": "4555.75",
  "impressions": "223700",
  "clicks": "11090",
  ...
}
```

## Fix Applied
Updated `/app/vitereact/src/components/views/UV_Campaigns.tsx`:

1. **Updated TypeScript Interfaces** - Changed interfaces to reflect actual API response structure:
   - Removed nested `MetricsData` interface
   - Added metric properties directly to `CampaignWithMetrics`, `AdSetWithMetrics`, and `AdWithMetrics` interfaces
   - Made metric properties accept both `number | string` types to handle API response format

2. **Updated Component Rendering** - Changed all metric property accesses:
   - From: `campaign.metrics.spend` 
   - To: `campaign.spend`
   - Added `Number()` conversion to ensure numeric operations work correctly

## Changes Made

### Before:
```typescript
interface CampaignWithMetrics extends Campaign {
  metrics: MetricsData;
  adsets?: AdSetWithMetrics[];
}

// In render:
{formatCurrency(campaign.metrics.spend)}
```

### After:
```typescript
interface CampaignWithMetrics extends Campaign {
  platform: string;
  account_name: string;
  spend: number | string;
  impressions: number | string;
  // ... other metric properties
  adsets?: AdSetWithMetrics[];
}

// In render:
{formatCurrency(Number(campaign.spend))}
```

## Files Modified
- `/app/vitereact/src/components/views/UV_Campaigns.tsx`

## Testing
After the fix:
1. Frontend was rebuilt: `npm run build`
2. Built assets were copied to `/app/backend/public/`
3. New bundle created: `index-g9fkHlBd.js`

## Expected Result
The Campaigns page should now:
- Load without errors
- Display the campaign list with all metrics
- Show correct values for spend, impressions, clicks, conversions, revenue, CTR, CPM, and ROAS
- Allow sorting, filtering, and pagination to work correctly

## Additional Notes
- The backend API at `/api/workspaces/:workspace_id/campaigns` returns campaigns with aggregated metrics from the `metrics_daily` table
- The API response structure matches the database query results, with metrics as top-level properties
- No backend changes were required - only frontend alignment with the actual API contract
