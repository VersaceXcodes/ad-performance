# Upload Wizard Test Helpers

## Overview

The Upload Wizard exposes test helpers via `window.__testHelpers` to enable automated browser testing without requiring file system access.

## Available Methods

### File Operations

#### `selectTestFile(filename, content)`
Creates and selects a test file programmatically.

**Parameters:**
- `filename` (string): Name of file with extension (.csv or .xlsx)
- `content` (string): File content as string

**Returns:** `boolean` - Success status

**Example:**
```javascript
window.__testHelpers.selectTestFile(
  'test-campaigns.csv',
  'campaign_name,impressions,clicks\nSummer Sale,10000,500'
);
```

### Platform Selection

#### `selectPlatform(platform)`
Selects the advertising platform.

**Parameters:**
- `platform` (string): Platform ID ('facebook', 'tiktok', 'snapchat')

**Returns:** `boolean` - Success status

**Example:**
```javascript
window.__testHelpers.selectPlatform('facebook');
```

### Navigation

#### `proceedToStep(step)`
Navigates to a specific wizard step.

**Parameters:**
- `step` (number): Step number (1-5)
  - 1: Select Files
  - 2: Choose Platform
  - 3: Configure
  - 4: Processing
  - 5: Complete

**Returns:** `boolean` - Success status

**Example:**
```javascript
window.__testHelpers.proceedToStep(3);
```

### Upload Control

#### `startUpload()`
Initiates the upload process.

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
await window.__testHelpers.startUpload();
```

### State Inspection

#### `getCurrentStep()`
Returns the current wizard step number.

**Returns:** `number` - Current step (1-5)

**Example:**
```javascript
const step = window.__testHelpers.getCurrentStep();
console.log('Current step:', step);
```

#### `hasValidFiles()`
Checks if valid files are selected.

**Returns:** `boolean` - True if valid files selected

**Example:**
```javascript
const hasFiles = window.__testHelpers.hasValidFiles();
console.log('Has valid files:', hasFiles);
```

#### `getSelectedPlatform()`
Returns the currently selected platform.

**Returns:** `string` - Platform ID or empty string

**Example:**
```javascript
const platform = window.__testHelpers.getSelectedPlatform();
console.log('Selected platform:', platform);
```

#### `canContinue()`
Checks if the user can proceed to the next step.

**Returns:** `boolean` - True if can continue

**Example:**
```javascript
const canProceed = window.__testHelpers.canContinue();
console.log('Can continue:', canProceed);
```

#### `getUploadState()`
Returns the complete upload state object.

**Returns:** `object` - State object containing:
- `step` (number): Current step
- `hasFiles` (boolean): Files selected
- `platform` (string): Selected platform
- `uploadJob` (object|null): Upload job details
- `progress` (object): Upload progress details

**Example:**
```javascript
const state = window.__testHelpers.getUploadState();
console.log('Upload state:', state);
```

## Complete Flow Example

```javascript
// Step 1: Create and select file
window.__testHelpers.selectTestFile(
  'test-data.csv',
  'campaign_name,impressions,clicks,spend,conversions\n' +
  'Summer Sale 2024,10000,500,250.00,25\n' +
  'Winter Promo 2024,15000,750,375.50,40'
);

// Verify file selection
console.log('Files valid:', window.__testHelpers.hasValidFiles());

// Step 2: Navigate to platform selection
window.__testHelpers.proceedToStep(2);

// Step 3: Select platform
window.__testHelpers.selectPlatform('facebook');
console.log('Platform selected:', window.__testHelpers.getSelectedPlatform());

// Step 4: Navigate to configuration
window.__testHelpers.proceedToStep(3);

// Wait for UI to update
await new Promise(resolve => setTimeout(resolve, 1000));

// Check for mapping templates
const hasTemplates = document.querySelector('[name="mapping_template"]') !== null;
console.log('Mapping templates visible:', hasTemplates);

// Step 5: Start upload
const uploadStarted = await window.__testHelpers.startUpload();
console.log('Upload started:', uploadStarted);

// Step 6: Monitor progress
const checkProgress = setInterval(() => {
  const state = window.__testHelpers.getUploadState();
  console.log('Progress:', state.progress?.progress_percentage + '%');
  
  if (state.uploadJob?.status === 'completed' || state.uploadJob?.status === 'failed') {
    clearInterval(checkProgress);
    console.log('Final status:', state.uploadJob.status);
  }
}, 2000);
```

## Error Handling

All methods return success status. Always check return values:

```javascript
const fileSelected = window.__testHelpers.selectTestFile('test.csv', 'data');
if (!fileSelected) {
  console.error('Failed to select file');
}

const platformSelected = window.__testHelpers.selectPlatform('facebook');
if (!platformSelected) {
  console.error('Failed to select platform');
}

const uploadStarted = await window.__testHelpers.startUpload();
if (!uploadStarted) {
  console.error('Failed to start upload');
}
```

## Prerequisites

### Availability
Test helpers are available when:
- On upload wizard page: `/w/{workspace_id}/upload`
- React component has mounted
- DOM is ready

### Check Availability
```javascript
if (typeof window.__testHelpers === 'undefined') {
  console.error('Test helpers not available');
} else {
  console.log('Test helpers ready');
}
```

### Wait for Availability (Playwright/Puppeteer)
```javascript
await page.waitForFunction(() => window.__testHelpers);
```

## Step Requirements

Each step has prerequisites:

### Step 1: Select Files
- No prerequisites
- Files must be valid (size < 50MB, extension .csv or .xlsx)

### Step 2: Choose Platform
- Requires: Valid files selected
- Must select one platform before continuing

### Step 3: Configure
- Requires: Valid files + platform selected
- Configuration options are optional

### Step 4: Processing
- Requires: Valid files + platform + configuration (if applicable)
- Automatically starts on upload initiation

### Step 5: Complete
- Requires: Upload job completed or failed
- Reached automatically after processing

## Common Patterns

### Wait for Upload Completion
```javascript
await window.__testHelpers.startUpload();

await new Promise((resolve) => {
  const interval = setInterval(() => {
    const state = window.__testHelpers.getUploadState();
    if (state.uploadJob?.status === 'completed' || state.uploadJob?.status === 'failed') {
      clearInterval(interval);
      resolve(state);
    }
  }, 2000);
});
```

### Retry on Failure
```javascript
async function uploadWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const success = await window.__testHelpers.startUpload();
    if (success) return true;
    
    console.log(`Retry ${i + 1}/${maxRetries}...`);
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}
```

### Complete State Check
```javascript
function checkReadiness() {
  const state = window.__testHelpers.getUploadState();
  return {
    ready: window.__testHelpers.canContinue(),
    step: state.step,
    files: state.hasFiles,
    platform: state.platform,
    issues: [
      !state.hasFiles && 'No files selected',
      !state.platform && 'No platform selected'
    ].filter(Boolean)
  };
}
```

## Testing Frameworks

### Playwright
```javascript
await page.goto('https://app.example.com/w/workspace_001/upload');
await page.waitForFunction(() => window.__testHelpers);

await page.evaluate(() => {
  window.__testHelpers.selectTestFile('test.csv', 'data');
  window.__testHelpers.proceedToStep(2);
  window.__testHelpers.selectPlatform('facebook');
  window.__testHelpers.proceedToStep(3);
});

await page.evaluate(() => window.__testHelpers.startUpload());
```

### Puppeteer
```javascript
await page.goto('https://app.example.com/w/workspace_001/upload');
await page.waitForFunction(() => window.__testHelpers);

const result = await page.evaluate(async () => {
  window.__testHelpers.selectTestFile('test.csv', 'data');
  window.__testHelpers.selectPlatform('facebook');
  return await window.__testHelpers.startUpload();
});

console.log('Upload result:', result);
```

### Selenium
```javascript
driver.get('https://app.example.com/w/workspace_001/upload');

await driver.wait(() => {
  return driver.executeScript('return typeof window.__testHelpers !== "undefined"');
}, 5000);

await driver.executeScript(`
  window.__testHelpers.selectTestFile('test.csv', 'data');
  window.__testHelpers.selectPlatform('facebook');
  return window.__testHelpers.startUpload();
`);
```

## Troubleshooting

### Helpers Not Available
```javascript
// Wait for helpers
await page.waitForSelector('[data-testid="file-drop-zone"]');
await page.waitForFunction(() => window.__testHelpers);
```

### File Not Valid
```javascript
// Check file validation
const hasValid = window.__testHelpers.hasValidFiles();
if (!hasValid) {
  console.log('File validation failed - check size and extension');
}
```

### Cannot Continue
```javascript
// Check what's missing
const state = window.__testHelpers.getUploadState();
console.log('Files:', state.hasFiles);
console.log('Platform:', state.platform);
console.log('Can continue:', window.__testHelpers.canContinue());
```

### Upload Timeout
```javascript
// Set reasonable timeout
const timeout = 60000; // 60 seconds
const startTime = Date.now();

const waitForUpload = () => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const state = window.__testHelpers.getUploadState();
      
      if (state.uploadJob?.status === 'completed') {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('Upload timeout'));
      }
    }, 2000);
  });
};
```

## Best Practices

1. **Always check return values** from helper methods
2. **Wait for state changes** after navigation
3. **Use polling** for upload progress monitoring
4. **Handle timeouts** appropriately
5. **Verify prerequisites** before proceeding to next step
6. **Log state** for debugging test failures

## Related Documentation

- Complete Guide: `/BROWSER_TESTING_FILE_UPLOAD_GUIDE.md`
- Test Script: `/test-file-upload-automation.js`
- Fix Details: `/FILE_UPLOAD_BROWSER_TEST_FIX.md`
- Component Source: `/vitereact/src/components/views/UV_UploadWizard.tsx`
