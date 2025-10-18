# Browser Testing Quick Start Guide

## The File Upload Problem
Browser automation cannot upload files using local file paths. The error `"File path test.csv is not available"` occurs because browser testing tools cannot access your local filesystem for security reasons.

## The Solution: Use the Test API Endpoint
Instead of trying to upload files through the UI, use our test API endpoint that creates sample data programmatically.

## Quick Example

### Step 1: Login and Get Token
```javascript
// Navigate to login page
await page.goto('https://123ad-performance.launchpulse.ai/signin');

// Fill in credentials
await page.fill('input[name="email"]', 'john.doe@example.com');
await page.fill('input[name="password"]', 'password123');

// Submit form
await page.click('button[type="submit"]');

// Wait for redirect
await page.waitForURL('**/w/workspace_001');

// Get auth token from localStorage
const authToken = await page.evaluate(() => {
  return localStorage.getItem('auth_token');
});
```

### Step 2: Create Test Upload via API (No File Upload Needed!)
```javascript
// Use the test endpoint to create an upload
const uploadResponse = await page.evaluate(async (token) => {
  const response = await fetch('/api/workspaces/workspace_001/uploads/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      test_mode: 'browser-testing',
      platform: 'facebook',
      filename: 'browser-test-data.csv'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  return response.json();
}, authToken);

console.log('✅ Upload created:', uploadResponse.id);
```

### Step 3: Verify Upload Appears in UI
```javascript
// Navigate to uploads page
await page.goto('https://123ad-performance.launchpulse.ai/w/workspace_001/uploads');

// Wait for the upload to appear
await page.waitForSelector(`text=${uploadResponse.original_filename}`, {
  timeout: 10000
});

console.log('✅ Upload visible in UI');
```

### Step 4: Poll Upload Status
```javascript
// Poll the upload status until it's complete
let uploadStatus = 'processing';
let attempts = 0;
const maxAttempts = 30; // 30 attempts = 60 seconds

while (uploadStatus === 'processing' && attempts < maxAttempts) {
  await page.waitForTimeout(2000); // Wait 2 seconds
  
  const status = await page.evaluate(async (uploadId, token) => {
    const response = await fetch(`/api/workspaces/workspace_001/uploads/${uploadId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.status;
  }, uploadResponse.id, authToken);
  
  uploadStatus = status;
  attempts++;
  
  console.log(`Upload status: ${uploadStatus} (attempt ${attempts}/${maxAttempts})`);
}

if (uploadStatus === 'completed') {
  console.log('✅ Upload completed successfully');
} else if (uploadStatus === 'failed') {
  console.log('❌ Upload failed');
} else {
  console.log('⏱️ Upload still processing after timeout');
}
```

## Complete Example Script (Playwright)

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Step 1: Login
    console.log('Logging in...');
    await page.goto('https://123ad-performance.launchpulse.ai/signin');
    await page.fill('input[name="email"]', 'john.doe@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/w/workspace_001');
    
    const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    console.log('✅ Logged in successfully');
    
    // Step 2: Create test upload via API
    console.log('Creating test upload...');
    const uploadResponse = await page.evaluate(async (token) => {
      const response = await fetch('/api/workspaces/workspace_001/uploads/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          test_mode: 'browser-testing',
          platform: 'facebook',
          filename: 'browser-test-upload.csv'
        })
      });
      return response.json();
    }, authToken);
    
    console.log('✅ Upload created:', uploadResponse.id);
    
    // Step 3: Navigate to uploads page
    console.log('Navigating to uploads page...');
    await page.goto('https://123ad-performance.launchpulse.ai/w/workspace_001/uploads');
    await page.waitForSelector(`text=${uploadResponse.original_filename}`);
    console.log('✅ Upload visible in UI');
    
    // Step 4: Wait for upload to complete
    console.log('Waiting for upload to complete...');
    let uploadStatus = 'processing';
    let attempts = 0;
    
    while (uploadStatus === 'processing' && attempts < 30) {
      await page.waitForTimeout(2000);
      
      const status = await page.evaluate(async (uploadId, token) => {
        const response = await fetch(`/api/workspaces/workspace_001/uploads/${uploadId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        return data.status;
      }, uploadResponse.id, authToken);
      
      uploadStatus = status;
      attempts++;
      console.log(`  Status: ${uploadStatus} (${attempts}/30)`);
    }
    
    if (uploadStatus === 'completed') {
      console.log('✅ Upload completed successfully!');
      console.log('');
      console.log('🎉 All tests passed!');
    } else {
      console.log('❌ Upload did not complete');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
```

## What to Test

### ✅ DO Test These
1. **Login flow** - Verify authentication works
2. **Navigation** - Navigate to upload page and verify UI elements
3. **Platform selection** - Click platform buttons, verify they're selectable
4. **API upload creation** - Use test endpoint to create uploads
5. **Upload history** - Verify uploads appear in the list
6. **Status tracking** - Poll upload status and verify it changes
7. **Completion UI** - Verify success/failure messages display correctly

### ❌ DON'T Test These (They Won't Work)
1. **File input interaction** - Cannot set file input values
2. **Drag and drop files** - Cannot simulate OS-level file drag/drop
3. **File picker dialog** - Cannot interact with native OS dialogs
4. **Client-side file validation** - Cannot test through file input

## Common Platforms for Testing
- `facebook` - Meta/Facebook Ads
- `google` - Google Ads
- `tiktok` - TikTok Ads
- `snapchat` - Snapchat Ads

## API Endpoints Reference

### Create Test Upload
```
POST /api/workspaces/workspace_001/uploads/test
Headers: Authorization: Bearer {token}
Body: { "test_mode": "browser-testing", "platform": "facebook", "filename": "test.csv" }
```

### Get Upload Status
```
GET /api/workspaces/workspace_001/uploads/{upload_id}
Headers: Authorization: Bearer {token}
```

### List All Uploads
```
GET /api/workspaces/workspace_001/uploads
Headers: Authorization: Bearer {token}
```

## Troubleshooting

### "AUTH_TOKEN_REQUIRED" Error
- Make sure you're logged in and have a valid auth token
- Check that the Authorization header is present

### "TEST_MODE_REQUIRED" Error
- Ensure `test_mode: "browser-testing"` is in your request body

### Upload Not Appearing in UI
- Wait a few seconds for the UI to refresh
- Try manually refreshing the page
- Check that you're looking at the correct workspace

### Upload Stuck in "processing"
- This is expected for the mock implementation
- The backend doesn't actually process files asynchronously yet
- You may need to manually update the upload status for testing

## Need Help?
Check these documentation files:
- `/api/test/file-upload-guide` - Detailed API guide endpoint
- `BROWSER_TESTING_FILE_UPLOAD_FINAL_RESOLUTION.md` - Complete technical documentation
- `/api/test/validate` - Validate your environment is set up correctly
