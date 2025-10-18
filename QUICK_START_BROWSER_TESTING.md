# Quick Start: Browser Testing File Upload

## 🚀 Fastest Way to Test

### Option 1: Use Test API (5 minutes)

```javascript
// 1. Login
const response = await fetch('https://123ad-performance.launchpulse.ai/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john.doe@example.com',
    password: 'password123'
  })
});
const { token } = await response.json();

// 2. Create test upload
const upload = await fetch('https://123ad-performance.launchpulse.ai/api/workspaces/workspace_001/uploads/test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    platform: 'facebook',
    filename: 'test.csv',
    csv_content: 'campaign,impressions,clicks\nTest,1000,50',
    test_mode: 'browser-testing'
  })
});
const uploadData = await upload.json();

// 3. Check status
console.log('Upload ID:', uploadData.id);
console.log('Status:', uploadData.status);
```

### Option 2: Use UI Helpers (10 minutes)

```javascript
// In Playwright/Puppeteer
await page.goto('https://123ad-performance.launchpulse.ai/w/workspace_001/uploads/wizard');

// Select file programmatically
await page.evaluate(() => {
  window.__testHelpers.selectTestFile('test.csv', 'campaign,impressions\nTest,1000');
});

// Continue through wizard
await page.click('#continue-to-platform-button');
await page.click('input[value="facebook"]');
await page.click('button:has-text("Start Upload")');
```

## 🔑 Key Changes

| Element | Old | New |
|---------|-----|-----|
| File Input | No ID | `id="file-upload-input"` |
| Continue Button | No ID | `id="continue-to-platform-button"` |
| Drop Zone | No attributes | `data-testid="file-drop-zone"` `data-has-files` |
| Test Helpers | None | `window.__testHelpers` available |
| Test Endpoint | Limited | Full feature support |

## 📋 Element IDs for Testing

```javascript
// File upload elements
'#file-upload-input'              // Hidden file input
'#file-upload-trigger-button'     // "Choose Files" button
'[data-testid="file-drop-zone"]'  // Drop zone area

// Navigation buttons
'#continue-to-platform-button'    // Step 1 → Step 2
'button:has-text("Start Upload")' // Step 3 → Step 4

// Platform selection
'input[value="facebook"]'         // Facebook radio
'input[value="google"]'           // Google radio  
'input[value="tiktok"]'           // TikTok radio
```

## 🧪 Test Helpers

```javascript
// Check if helpers are loaded
if (window.__testHelpers) {
  // Select file
  window.__testHelpers.selectTestFile('name.csv', 'content');
  
  // Check state
  const hasFiles = window.__testHelpers.hasValidFiles(); // true/false
  const step = window.__testHelpers.getCurrentStep();    // 1-5
}
```

## 🔗 API Endpoints

```
POST /api/workspaces/{workspace_id}/uploads/test
  → Create test upload (bypass UI)

GET  /api/workspaces/{workspace_id}/uploads/{upload_id}
  → Check upload status

GET  /api/workspaces/{workspace_id}/uploads
  → List all uploads
```

## ✅ Quick Validation

```bash
# Test the API endpoint
node /app/test-file-upload-fix.js

# Expected: All checks pass ✅
```

## 📚 Full Documentation

- `BROWSER_TESTING_FILE_UPLOAD_COMPLETE_FIX.md` - Complete technical docs
- `playwright-upload-test-example.js` - Full Playwright examples
- `FILE_UPLOAD_FIX_SUMMARY.md` - Summary of all changes

## ⚡ Common Issues

**Issue**: `window.__testHelpers is undefined`  
**Fix**: Wait for page load: `await page.waitForFunction(() => window.__testHelpers)`

**Issue**: Continue button disabled  
**Fix**: Ensure file is valid: `window.__testHelpers.hasValidFiles()` returns `true`

**Issue**: Test endpoint returns 401  
**Fix**: Add auth header: `Authorization: Bearer ${token}`

---

**Ready to test!** Start with Option 1 (API) for fastest results.
