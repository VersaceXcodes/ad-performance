# Browser Testing File Upload Resolution

## Issue
Browser automation tools (Playwright, Puppeteer, Selenium) cannot upload files using local file paths in the traditional way because:
1. File input elements require actual File objects, not string paths
2. Security restrictions prevent browser automation from accessing arbitrary file system paths
3. The error "File path test.csv is not available" occurs when trying to use `upload_file` action

## Solution
The backend already provides a **test upload endpoint** specifically designed for browser testing that creates sample data programmatically without requiring actual file uploads.

## Test Upload Endpoint

### Endpoint Details
```
POST /api/workspaces/{workspace_id}/uploads/test
```

### Authentication
**Required**: Bearer token in Authorization header

### Request Body
```json
{
  "test_mode": "browser-testing",
  "platform": "facebook",
  "filename": "test-data.csv"
}
```

### Valid Platforms
- `facebook`
- `google`
- `tiktok`
- `snapchat`
- `linkedin`
- `twitter`

### Example cURL Request
```bash
curl -X POST https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/uploads/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "test_mode": "browser-testing",
    "platform": "facebook",
    "filename": "test-data.csv"
  }'
```

### Example JavaScript/Playwright Request
```javascript
// After successful login and getting auth token
const response = await fetch('https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/uploads/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    test_mode: 'browser-testing',
    platform: 'facebook',
    filename: 'test-data.csv'
  })
});

const uploadJob = await response.json();
console.log('Upload job created:', uploadJob.id);
```

### Response Example
```json
{
  "id": "upload_test_123",
  "workspace_id": "workspace_001",
  "user_id": "user_001",
  "filename": "test_1760772491729_test-data.csv",
  "original_filename": "test-data.csv",
  "file_size": 1024,
  "platform": "facebook",
  "status": "processing",
  "progress": 0,
  "rows_processed": 0,
  "rows_total": 0,
  "rows_success": 0,
  "rows_error": 0,
  "test_mode": true,
  "message": "Test upload created successfully for browser testing",
  "created_at": "2025-10-18T07:28:11.729Z"
}
```

## Browser Testing Strategy

### What CAN Be Tested
1. **Upload UI Navigation**: Navigate to upload page, verify UI elements are present
2. **Platform Selection**: Click on platform buttons and verify selection
3. **Date Range Configuration**: Fill in date fields
4. **Mapping Template Selection**: Select mapping templates from list
5. **Test Upload Creation**: Use the test endpoint to create upload jobs programmatically
6. **Upload History**: Verify uploads appear in the history list
7. **Upload Progress**: Track upload job status changes
8. **Upload Status Display**: Verify completed/failed status displays correctly

### What CANNOT Be Tested (File Input Limitations)
1. **Actual File Selection**: Cannot interact with native file picker dialog
2. **Drag & Drop Files**: Cannot simulate OS-level drag and drop with real files
3. **File Validation**: Cannot test client-side file size/type validation through file input

## Updated Browser Testing Workflow

### 1. Login
```javascript
await page.goto('https://123ad-performance.launchpulse.ai/signin');
await page.fill('input[type="email"]', 'john.doe@example.com');
await page.fill('input[type="password"]', 'password123');
await page.click('button[type="submit"]');

// Get auth token from localStorage or response
const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
```

### 2. Navigate to Upload Page
```javascript
await page.goto('https://123ad-performance.launchpulse.ai/w/workspace_001/upload');
```

### 3. Test UI Elements (Without File Upload)
```javascript
// Verify upload wizard is present
const wizardTitle = await page.textContent('h1');
expect(wizardTitle).toBe('Upload Data');

// Verify platform selection buttons exist
const platformButtons = await page.locator('[name="platform"]').count();
expect(platformButtons).toBeGreaterThan(0);

// Select a platform
await page.click('[value="facebook"]');

// Verify Continue button state
const continueButton = await page.locator('text=Continue');
await continueButton.click();
```

### 4. Create Test Upload via API
```javascript
// Use the test endpoint to create upload programmatically
const response = await page.evaluate(async (token) => {
  const res = await fetch('/api/workspaces/workspace_001/uploads/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      test_mode: 'browser-testing',
      platform: 'facebook',
      filename: 'test-data.csv'
    })
  });
  return res.json();
}, authToken);

console.log('Upload created:', response.id);
```

### 5. Verify Upload in History
```javascript
// Navigate to uploads page
await page.goto('https://123ad-performance.launchpulse.ai/w/workspace_001/uploads');

// Wait for upload to appear in list
await page.waitForSelector(`text=${response.original_filename}`);

// Verify upload status
const status = await page.textContent('[data-upload-status]');
expect(status).toMatch(/processing|completed/i);
```

## Key Endpoints for Browser Testing

### 1. Test Upload Creation
```
POST /api/workspaces/{workspace_id}/uploads/test
```

### 2. Get Upload Status
```
GET /api/workspaces/{workspace_id}/uploads/{upload_id}
```

### 3. List All Uploads
```
GET /api/workspaces/{workspace_id}/uploads
```

### 4. Browser Testing Validation
```
GET /api/test/validate
GET /api/test/connectivity
GET /api/test/file-upload-guide
```

## Sample CSV Data Created by Test Endpoint
The test endpoint creates a minimal CSV file with the following structure:
```csv
campaign_name,impressions,clicks,spend,conversions
Test Campaign,10000,500,250.50,25
```

This allows upload processing to run and complete successfully, providing realistic test data.

## Error Handling
If you encounter errors when using the test endpoint:

1. **AUTH_TOKEN_REQUIRED**: Ensure Authorization header is present
2. **PLATFORM_REQUIRED**: Ensure platform is specified in request body
3. **TEST_MODE_REQUIRED**: Ensure test_mode is set to "browser-testing"
4. **INVALID_PLATFORM**: Use one of the valid platform values listed above
5. **WORKSPACE_ACCESS_DENIED**: Ensure user has access to the workspace

## Production vs Test Mode
- **Production uploads**: Use `POST /api/workspaces/{workspace_id}/uploads` with multipart/form-data
- **Browser testing uploads**: Use `POST /api/workspaces/{workspace_id}/uploads/test` with JSON
- Test uploads are marked with `test_mode: true` in the response
- Test uploads are stored in the database alongside regular uploads
- Test uploads create actual CSV files in the storage directory

## Recommendations
1. Use the test endpoint for all browser automation testing
2. Test the upload UI flow without attempting actual file selection
3. Focus on testing upload history, status tracking, and result displays
4. Verify error messages and validation work correctly
5. Test workspace switching with active uploads
6. Verify upload progress tracking and notifications

## Implementation Status
✅ Test upload endpoint implemented at `/api/workspaces/{workspace_id}/uploads/test`  
✅ Sample CSV generation working  
✅ Upload processing mock working  
✅ Test mode flag in response  
✅ Authentication and authorization working  
✅ File storage in backend/storage directory  
✅ Database record creation working  

## Next Steps for Browser Testing
1. Update browser testing script to use test endpoint instead of file upload
2. Remove file upload interaction attempts from test cases
3. Focus on UI validation and API-based upload creation
4. Test upload status polling and completion detection
5. Verify error handling for failed uploads
