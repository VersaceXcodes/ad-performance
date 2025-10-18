/**
 * Playwright Example Test for File Upload
 * 
 * This is a complete example showing how to test file upload functionality
 * using the browser testing helpers and test endpoint
 */

// This would be in your Playwright test file
// import { test, expect } from '@playwright/test';

const BASE_URL = 'https://123ad-performance.launchpulse.ai';
const WORKSPACE_ID = 'workspace_001';

// Example 1: Using UI Test Helpers (Recommended for UI testing)
async function testFileUploadWithUIHelpers(page) {
  console.log('Testing file upload with UI helpers...');

  // Login first
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'john.doe@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/w/${WORKSPACE_ID}`);

  // Navigate to upload wizard
  await page.goto(`${BASE_URL}/w/${WORKSPACE_ID}/uploads/wizard`);
  await page.waitForLoadState('domcontentloaded');

  // Wait for test helpers to be available
  await page.waitForFunction(() => window.__testHelpers !== undefined);

  // Step 1: Select file using test helper
  await page.evaluate(() => {
    window.__testHelpers.selectTestFile(
      'playwright-test.csv',
      'campaign_name,impressions,clicks,spend,conversions\n' +
      'Playwright Test Campaign,15000,750,375.50,38\n' +
      'Another Test Campaign,12000,600,300.00,30'
    );
  });

  // Wait a bit for validation
  await page.waitForTimeout(500);

  // Verify file is selected and valid
  const hasValidFiles = await page.evaluate(() => 
    window.__testHelpers.hasValidFiles()
  );
  console.log('Has valid files:', hasValidFiles);
  
  if (!hasValidFiles) {
    throw new Error('File validation failed');
  }

  // Verify Continue button is enabled
  const continueButton = page.locator('#continue-to-platform-button');
  const isDisabled = await continueButton.isDisabled();
  console.log('Continue button disabled:', isDisabled);
  
  if (isDisabled) {
    throw new Error('Continue button should be enabled after file selection');
  }

  // Step 2: Click continue to go to platform selection
  await continueButton.click();
  await page.waitForTimeout(500);

  // Verify we're on step 2
  const currentStep = await page.evaluate(() => 
    window.__testHelpers.getCurrentStep()
  );
  console.log('Current step:', currentStep);
  
  if (currentStep !== 2) {
    throw new Error(`Expected step 2, got step ${currentStep}`);
  }

  // Step 3: Select platform
  await page.click('input[value="facebook"]');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);

  // Step 4: Configure options (optional)
  await page.click('button:has-text("Start Upload")');

  // Step 5: Wait for processing page
  await page.waitForSelector('text=Processing Upload', { timeout: 5000 });
  console.log('Upload started successfully!');

  // Step 6: Monitor progress
  let attempts = 0;
  while (attempts < 10) {
    const statusText = await page.textContent('p:has-text("Current Status")');
    console.log('Status:', statusText);

    // Check if completed or failed
    const isCompleted = await page.locator('text=Upload Completed').isVisible().catch(() => false);
    const isFailed = await page.locator('text=Upload Failed').isVisible().catch(() => false);

    if (isCompleted || isFailed) {
      console.log(isCompleted ? 'Upload completed!' : 'Upload failed!');
      break;
    }

    await page.waitForTimeout(2000);
    attempts++;
  }

  console.log('✅ UI test completed successfully');
}

// Example 2: Using Test API Endpoint (Recommended for API testing)
async function testFileUploadWithAPI(page) {
  console.log('Testing file upload with API endpoint...');

  // Login via API
  const loginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      email: 'john.doe@example.com',
      password: 'password123'
    }
  });

  const loginData = await loginResponse.json();
  const token = loginData.token;

  if (!token) {
    throw new Error('Login failed - no token received');
  }

  console.log('Logged in successfully');

  // Create test upload via API
  const uploadResponse = await page.request.post(
    `${BASE_URL}/api/workspaces/${WORKSPACE_ID}/uploads/test`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        platform: 'facebook',
        filename: 'api-test-data.csv',
        csv_content: 'campaign_name,impressions,clicks,spend,conversions\nAPI Test Campaign,20000,1000,500.00,50',
        test_mode: 'browser-testing',
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      }
    }
  );

  if (!uploadResponse.ok()) {
    throw new Error(`Upload API request failed: ${uploadResponse.status()}`);
  }

  const uploadData = await uploadResponse.json();
  console.log('Upload created:', uploadData.id);
  console.log('Status:', uploadData.status);

  // Navigate to upload details in UI
  await page.goto(`${BASE_URL}/w/${WORKSPACE_ID}/uploads/wizard?upload_id=${uploadData.id}&step=4`);
  await page.waitForLoadState('domcontentloaded');

  // Verify upload is shown in UI
  await page.waitForSelector('text=Processing Upload', { timeout: 5000 });
  console.log('Upload visible in UI');

  // Poll status via API
  let attempts = 0;
  while (attempts < 10) {
    const statusResponse = await page.request.get(
      `${BASE_URL}/api/workspaces/${WORKSPACE_ID}/uploads/${uploadData.id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const status = await statusResponse.json();
    console.log(`Status: ${status.status} (${status.progress}%)`);
    console.log(`Rows: ${status.rows_processed}/${status.rows_total}`);

    if (status.status === 'completed' || status.status === 'failed') {
      console.log(status.status === 'completed' ? 'Upload completed!' : 'Upload failed!');
      break;
    }

    await page.waitForTimeout(2000);
    attempts++;
  }

  console.log('✅ API test completed successfully');
}

// Example 3: Traditional File Upload (If file exists in test environment)
async function testTraditionalFileUpload(page) {
  console.log('Testing traditional file upload...');

  const fs = require('fs');
  const path = require('path');

  // Create temporary test file
  const tempDir = '/tmp';
  const testFilePath = path.join(tempDir, 'traditional-test.csv');
  const csvContent = 'campaign_name,impressions,clicks,spend,conversions\nTraditional Test,5000,250,125.00,13';
  
  fs.writeFileSync(testFilePath, csvContent);
  console.log('Created test file:', testFilePath);

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'john.doe@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/w/${WORKSPACE_ID}`);

  // Navigate to upload wizard
  await page.goto(`${BASE_URL}/w/${WORKSPACE_ID}/uploads/wizard`);
  await page.waitForLoadState('domcontentloaded');

  // Upload file using file input
  const fileInput = page.locator('#file-upload-input');
  await fileInput.setInputFiles(testFilePath);

  // Wait for file validation
  await page.waitForTimeout(500);

  // Verify file is shown in UI
  const hasFiles = await page.getAttribute('[data-testid="file-drop-zone"]', 'data-has-files');
  console.log('Has files in drop zone:', hasFiles);

  if (hasFiles !== 'true') {
    throw new Error('File not detected in drop zone');
  }

  // Continue through wizard
  await page.click('#continue-to-platform-button');
  await page.click('input[value="facebook"]');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Start Upload")');

  // Wait for processing
  await page.waitForSelector('text=Processing Upload', { timeout: 5000 });
  console.log('Upload started successfully');

  // Clean up temp file
  fs.unlinkSync(testFilePath);
  console.log('Cleaned up test file');

  console.log('✅ Traditional upload test completed successfully');
}

// Export for use in Playwright tests
module.exports = {
  testFileUploadWithUIHelpers,
  testFileUploadWithAPI,
  testTraditionalFileUpload
};

// If running standalone, execute all tests
if (require.main === module) {
  console.log('⚠️  This is an example file. Use it in your Playwright test suite.');
  console.log('Import the functions and call them in your test:');
  console.log('');
  console.log('const { testFileUploadWithUIHelpers } = require("./playwright-upload-test-example");');
  console.log('');
  console.log('test("file upload with UI helpers", async ({ page }) => {');
  console.log('  await testFileUploadWithUIHelpers(page);');
  console.log('});');
}
