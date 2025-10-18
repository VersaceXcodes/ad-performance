# Browser Testing Guide: File Upload Interface

## Overview

This guide explains how to test the file upload interface using automated browser testing tools like Playwright, Puppeteer, Selenium, or HyperBrowser.

## Problem Statement

The file upload wizard requires users to select files from their local file system. Automated browser testing tools cannot access the agent's file system, making it impossible to test the full upload flow using traditional file input methods.

## Solution

We've exposed JavaScript test helpers via `window.__testHelpers` that allow programmatic file creation and upload without requiring file system access.

## Available Test Helpers

### File Selection

```javascript
// Create and select a test CSV file
window.__testHelpers.selectTestFile(
  'test-data.csv',  // filename
  'campaign_name,impressions,clicks\nTest Campaign,1000,50'  // CSV content
);
```

### Platform Selection

```javascript
// Select advertising platform
window.__testHelpers.selectPlatform('facebook');  // or 'tiktok', 'snapchat'
```

### Navigation

```javascript
// Navigate to specific wizard step
window.__testHelpers.proceedToStep(2);  // 1=Files, 2=Platform, 3=Config, 4=Processing, 5=Complete
```

### Upload Execution

```javascript
// Start the upload process (async)
await window.__testHelpers.startUpload();
```

### State Inspection

```javascript
// Check current wizard step
const step = window.__testHelpers.getCurrentStep();

// Check if valid files are selected
const hasFiles = window.__testHelpers.hasValidFiles();

// Get selected platform
const platform = window.__testHelpers.getSelectedPlatform();

// Check if can proceed to next step
const canContinue = window.__testHelpers.canContinue();

// Get complete upload state
const state = window.__testHelpers.getUploadState();
// Returns: { step, hasFiles, platform, uploadJob, progress }
```

## Complete Test Flow Example

### Using JavaScript Console

```javascript
// Step 1: Navigate to upload wizard
// (Already on /w/workspace_001/upload)

// Step 2: Add test file
window.__testHelpers.selectTestFile(
  'test-campaign-data.csv',
  'campaign_name,impressions,clicks,spend,conversions\n' +
  'Summer Sale 2024,10000,500,250.00,25\n' +
  'Winter Promo 2024,15000,750,375.50,40'
);

// Step 3: Verify file was added
console.log('Has valid files:', window.__testHelpers.hasValidFiles());

// Step 4: Proceed to platform selection
window.__testHelpers.proceedToStep(2);

// Step 5: Select platform
window.__testHelpers.selectPlatform('facebook');

// Step 6: Verify platform selection
console.log('Selected platform:', window.__testHelpers.getSelectedPlatform());

// Step 7: Proceed to configuration
window.__testHelpers.proceedToStep(3);

// Step 8: Start upload (configuration is optional)
await window.__testHelpers.startUpload();

// Step 9: Monitor upload progress
setInterval(() => {
  const state = window.__testHelpers.getUploadState();
  console.log('Upload state:', state);
  if (state.uploadJob?.status === 'completed' || state.uploadJob?.status === 'failed') {
    console.log('Upload finished with status:', state.uploadJob.status);
  }
}, 2000);
```

### Using Playwright

```javascript
// Navigate to upload wizard
await page.goto('https://123ad-performance.launchpulse.ai/w/workspace_001/upload');

// Wait for page to load
await page.waitForSelector('[data-testid="file-drop-zone"]');

// Execute test helpers in browser context
await page.evaluate(() => {
  // Select test file
  window.__testHelpers.selectTestFile(
    'test-data.csv',
    'campaign_name,impressions,clicks\nTest Campaign,1000,50'
  );
});

// Verify file selection
const hasFiles = await page.evaluate(() => window.__testHelpers.hasValidFiles());
console.log('Files selected:', hasFiles);

// Navigate to platform selection
await page.evaluate(() => window.__testHelpers.proceedToStep(2));

// Select platform
await page.evaluate(() => window.__testHelpers.selectPlatform('facebook'));

// Proceed to configuration
await page.evaluate(() => window.__testHelpers.proceedToStep(3));

// Start upload
await page.evaluate(async () => {
  await window.__testHelpers.startUpload();
});

// Wait for upload to complete
await page.waitForFunction(() => {
  const state = window.__testHelpers.getUploadState();
  return state.uploadJob?.status === 'completed' || state.uploadJob?.status === 'failed';
}, { timeout: 30000 });

// Get final state
const finalState = await page.evaluate(() => window.__testHelpers.getUploadState());
console.log('Upload completed:', finalState);
```

### Using HyperBrowser Agent Instructions

When using HyperBrowser or similar automated testing agents, provide these instructions:

```
1. Navigate to the upload wizard page
2. Execute: window.__testHelpers.selectTestFile('test-data.csv', 'campaign_name,impressions,clicks\nTest,1000,50')
3. Verify files selected: window.__testHelpers.hasValidFiles()
4. Execute: window.__testHelpers.proceedToStep(2)
5. Execute: window.__testHelpers.selectPlatform('facebook')
6. Execute: window.__testHelpers.proceedToStep(3)
7. Execute: await window.__testHelpers.startUpload()
8. Poll state with: window.__testHelpers.getUploadState()
9. Check for mapping template options in the DOM (they should be visible on step 3)
```

## Troubleshooting

### Test Helper Not Available

If `window.__testHelpers` is undefined:

1. Ensure you're on the upload wizard page (`/w/{workspace_id}/upload`)
2. Wait for React to mount: `await page.waitForSelector('[data-testid="file-drop-zone"]')`
3. Verify the component has loaded: `await page.waitForFunction(() => window.__testHelpers)`

### File Not Accepted

If the file validation fails:

- Ensure filename has `.csv` or `.xlsx` extension
- Check file size (must be under 50MB)
- Verify CSV content is properly formatted

### Cannot Proceed to Next Step

If `proceedToStep()` returns false:

- Check `window.__testHelpers.canContinue()` to see if requirements are met
- Verify files are selected: `window.__testHelpers.hasValidFiles()`
- Verify platform is selected: `window.__testHelpers.getSelectedPlatform()`

### Upload Fails

If upload fails:

- Check console for error messages
- Verify authentication token is valid
- Ensure workspace_id in URL is correct
- Check network tab for API errors

## Testing Different File Types

### CSV File

```javascript
window.__testHelpers.selectTestFile(
  'campaigns.csv',
  'campaign_name,impressions,clicks,spend,conversions\n' +
  'Campaign 1,10000,500,250.00,25\n' +
  'Campaign 2,15000,750,375.50,40'
);
```

### XLSX File (Base64 Encoded)

```javascript
// Note: For XLSX, you'll need to provide base64-encoded content
// This is more complex and typically requires a library
window.__testHelpers.selectTestFile(
  'campaigns.xlsx',
  base64EncodedXlsxContent
);
```

## Platform Options

Supported platforms:
- `facebook` - Meta (Facebook) Ads
- `tiktok` - TikTok Ads
- `snapchat` - Snapchat Ads

## Wizard Steps

1. **Step 1: Select Files** - Choose data files to upload
2. **Step 2: Choose Platform** - Select advertising platform
3. **Step 3: Configure** - Set date range and mapping templates (optional)
4. **Step 4: Processing** - Upload and process data
5. **Step 5: Complete** - View results and summary

## Expected Test Results

After successful upload:

```javascript
{
  step: 5,  // Completion step
  hasFiles: true,
  platform: 'facebook',
  uploadJob: {
    id: 'upload_xxx',
    status: 'completed',
    progress: 100,
    rows_total: 2,
    rows_success: 2,
    rows_error: 0,
    // ... other fields
  },
  progress: {
    current_step: 'completed',
    progress_percentage: 100,
    rows_processed: 2,
    rows_total: 2
  }
}
```

## Best Practices

1. **Always wait for helpers to be available** before executing commands
2. **Check return values** - most helpers return boolean indicating success
3. **Use async/await** for `startUpload()` as it's an asynchronous operation
4. **Poll state** during processing to monitor upload progress
5. **Handle errors** - wrap calls in try/catch blocks
6. **Verify each step** before proceeding to the next

## Common Issues and Solutions

### Issue: "Continue" button remains disabled

**Solution**: Ensure file is valid and selected:
```javascript
const hasFiles = window.__testHelpers.hasValidFiles();
if (!hasFiles) {
  window.__testHelpers.selectTestFile('test.csv', 'col1,col2\nval1,val2');
}
```

### Issue: Upload job not created

**Solution**: Verify all requirements are met:
```javascript
const state = window.__testHelpers.getUploadState();
console.log('Current state:', state);

// Ensure:
// - state.hasFiles === true
// - state.platform !== ''
// - state.step === 3
```

### Issue: Mapping templates not visible

**Solution**: Navigate to step 3 and inspect DOM:
```javascript
window.__testHelpers.proceedToStep(3);

// Wait for templates to load
await new Promise(resolve => setTimeout(resolve, 1000));

// Check if templates section is visible
const hasTemplates = document.querySelector('[name="mapping_template"]') !== null;
console.log('Has mapping templates:', hasTemplates);
```

## API Integration

The test helpers interact with these backend endpoints:

- `POST /api/workspaces/{workspace_id}/uploads` - Create upload job
- `GET /api/workspaces/{workspace_id}/uploads/{upload_id}` - Check upload status
- `GET /api/workspaces/{workspace_id}/mapping-templates` - Fetch mapping templates

Ensure these endpoints are accessible and returning expected responses.

## Conclusion

Using these test helpers, you can fully automate testing of the file upload interface without requiring access to the agent's file system. The helpers provide complete control over the wizard flow and upload process.

For additional support or questions, refer to the component documentation in `/vitereact/src/components/views/UV_UploadWizard.tsx`.
