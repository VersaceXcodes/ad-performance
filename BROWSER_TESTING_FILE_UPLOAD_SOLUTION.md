# Browser Testing File Upload Solution

## Issue Summary
The browser testing automation was failing when attempting to upload files because:
1. The test file `dummy_upload.csv` didn't exist in an accessible location
2. The file input element needed better accessibility for automation tools

## Solution Implemented

### 1. Created Test Files
Created `dummy_upload.csv` in multiple locations for browser testing:
- `/app/dummy_upload.csv` - Root level for direct access
- `/app/backend/public/dummy_upload.csv` - Accessible via HTTP

**File Contents:**
```csv
campaign_name,impressions,clicks,spend,conversions,date
Test Campaign 1,10000,500,250.50,25,2025-10-01
Test Campaign 2,15000,750,375.75,38,2025-10-02
Test Campaign 3,12000,600,300.00,30,2025-10-03
```

### 2. Improved File Input Accessibility
Modified the file input element in `UV_UploadWizard.tsx` to be more accessible for browser automation:

**Before:**
```tsx
<input className="hidden" ... />
```

**After:**
```tsx
<input 
  className="absolute inset-0 opacity-0 cursor-pointer"
  style={{ width: '100%', height: '100%' }}
  ...
/>
```

This change:
- Makes the input element overlay the "Choose Files" button
- Keeps it functionally hidden (`opacity-0`) but not removed from DOM
- Allows browser automation tools to interact with it directly
- Maintains proper cursor behavior for manual testing

### 3. Test Helper Functions
The upload wizard already includes test helper functions (lines 380-393):

```javascript
window.__testHelpers = {
  selectTestFile: (filename, content) => {
    // Creates a programmatic file object for testing
  },
  getCurrentStep: () => wizardStep,
  hasValidFiles: () => /* validation check */
}
```

## Testing Approaches

### Approach 1: Using Test Helpers (Recommended for Unit/Integration Tests)
```javascript
// In your test code
window.__testHelpers.selectTestFile('test-data.csv', 'campaign_name,impressions\nTest,1000');
```

### Approach 2: Direct File Input Interaction (Recommended for E2E Tests)
```javascript
// Using Playwright
await page.setInputFiles('#file-upload-input', '/app/dummy_upload.csv');

// Using Puppeteer
const fileInput = await page.$('#file-upload-input');
await fileInput.uploadFile('/app/dummy_upload.csv');

// Using Selenium
WebElement fileInput = driver.findElement(By.id("file-upload-input"));
fileInput.sendKeys("/app/dummy_upload.csv");
```

### Approach 3: URL-based File Access (For Remote Testing)
If testing from a remote browser service:
1. Upload file is available at: `https://123ad-performance.launchpulse.ai/dummy_upload.csv`
2. Download it to the test environment first
3. Then upload using the local path

## File Upload Flow

### Step 1: Select Files (Current Step in Test)
- User clicks "Choose Files" button or drops files
- Files are validated (size < 50MB, type = CSV/XLSX)
- Valid files are displayed in the file list
- "Continue" button becomes enabled

### Step 2: Choose Platform
- User selects advertising platform (Facebook, TikTok, Snapchat)
- "Continue" button becomes enabled

### Step 3: Configure
- User optionally sets date range
- User optionally selects mapping template
- "Start Upload" button initiates the upload

### Step 4: Processing
- Upload progress is tracked in real-time
- Progress percentage and row count displayed

### Step 5: Complete
- Success/failure status shown
- Statistics displayed (total rows, successful, errors)
- Option to view dashboard or try again

## Verification Steps

To verify the fix works:

1. **File Exists:**
   ```bash
   ls -la /app/dummy_upload.csv
   ls -la /app/backend/public/dummy_upload.csv
   ```

2. **File is Accessible via HTTP:**
   ```bash
   curl https://123ad-performance.launchpulse.ai/dummy_upload.csv
   ```

3. **File Input is Accessible:**
   - Element ID: `#file-upload-input`
   - Element is in DOM (not hidden)
   - Element has `opacity: 0` but `pointer-events: auto`
   - Element accepts `.csv,.xlsx` files

4. **Test Flow:**
   ```javascript
   // Navigate to upload wizard
   await page.goto(`${BASE_URL}/w/workspace_001/upload`);
   
   // Upload file
   await page.setInputFiles('#file-upload-input', '/app/dummy_upload.csv');
   
   // Verify file is selected
   const hasFiles = await page.evaluate(() => 
     window.__testHelpers?.hasValidFiles()
   );
   expect(hasFiles).toBe(true);
   
   // Continue to next step
   await page.click('#continue-to-platform-button');
   
   // Select platform
   await page.click('input[value="facebook"]');
   
   // Continue to configuration
   await page.click('button:has-text("Continue")');
   
   // Start upload
   await page.click('button:has-text("Start Upload")');
   ```

## Common Issues and Solutions

### Issue: "File path not available"
**Cause:** File doesn't exist or isn't accessible
**Solution:** Use one of the created test files or create your own

### Issue: "Unable to interact with file input"
**Cause:** Element is `display: none` or not in DOM
**Solution:** Use the updated file input with `opacity: 0` instead

### Issue: "Continue button is disabled"
**Cause:** No valid files selected
**Solution:** Ensure file validation passes (correct type and size)

### Issue: "Mapping template options not visible"
**Cause:** Must complete previous steps first
**Solution:** 
1. Upload file in Step 1
2. Select platform in Step 2
3. Then mapping templates will load in Step 3

## Testing URLs
- **Frontend:** https://123ad-performance.launchpulse.ai
- **Upload Wizard:** https://123ad-performance.launchpulse.ai/w/workspace_001/upload
- **Test File:** https://123ad-performance.launchpulse.ai/dummy_upload.csv

## Additional Notes

1. **File Validation:** Files must be:
   - CSV or XLSX format
   - Less than 50MB in size
   - Non-empty

2. **Platform Selection Required:** Cannot proceed to Step 3 without selecting a platform

3. **Real-time Updates:** Upload progress updates every 2 seconds via polling

4. **Error Handling:** Failed uploads can be reprocessed from the Upload Management page

5. **Test Data:** The dummy CSV contains 3 rows of test campaign data
