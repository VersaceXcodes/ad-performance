/**
 * Browser Testing Upload Helper
 * 
 * This helper module provides functions to work around the file upload limitation
 * in browser automation testing.
 * 
 * Usage with Playwright:
 * const { createTestUpload, pollUploadStatus } = require('./browser-test-upload-helper');
 * 
 * const upload = await createTestUpload(page, authToken, {
 *   workspace_id: 'workspace_001',
 *   platform: 'facebook',
 *   filename: 'test-data.csv'
 * });
 * 
 * const finalStatus = await pollUploadStatus(page, authToken, upload.id, 'workspace_001');
 */

/**
 * Creates a test upload using the API endpoint (bypasses file input)
 * 
 * @param {Page} page - Playwright page object
 * @param {string} authToken - Authentication token
 * @param {object} options - Upload options
 * @param {string} options.workspace_id - Workspace ID (default: 'workspace_001')
 * @param {string} options.platform - Platform name (facebook, google, tiktok, snapchat)
 * @param {string} options.filename - Filename for the upload (default: 'test-data.csv')
 * @returns {Promise<object>} Upload job object
 */
async function createTestUpload(page, authToken, options = {}) {
  const {
    workspace_id = 'workspace_001',
    platform = 'facebook',
    filename = 'test-data.csv'
  } = options;

  console.log(`Creating test upload: platform=${platform}, filename=${filename}`);

  const uploadResponse = await page.evaluate(async ({ token, workspace, platform, filename }) => {
    const response = await fetch(`/api/workspaces/${workspace}/uploads/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        test_mode: 'browser-testing',
        platform: platform,
        filename: filename
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Upload API failed: ${error.message || response.statusText}`);
    }

    return response.json();
  }, { token: authToken, workspace: workspace_id, platform, filename });

  console.log(`✅ Upload created: ${uploadResponse.id}`);
  return uploadResponse;
}

/**
 * Polls upload status until completion or timeout
 * 
 * @param {Page} page - Playwright page object
 * @param {string} authToken - Authentication token
 * @param {string} uploadId - Upload job ID
 * @param {string} workspaceId - Workspace ID
 * @param {object} options - Polling options
 * @param {number} options.maxAttempts - Maximum polling attempts (default: 30)
 * @param {number} options.intervalMs - Interval between polls in ms (default: 2000)
 * @returns {Promise<object>} Final upload status object
 */
async function pollUploadStatus(page, authToken, uploadId, workspaceId = 'workspace_001', options = {}) {
  const {
    maxAttempts = 30,
    intervalMs = 2000
  } = options;

  console.log(`Polling upload status: ${uploadId}`);

  let attempts = 0;
  let uploadStatus = 'processing';
  let uploadData = null;

  while (!['completed', 'failed'].includes(uploadStatus) && attempts < maxAttempts) {
    attempts++;
    
    // Wait before polling (except first attempt)
    if (attempts > 1) {
      await page.waitForTimeout(intervalMs);
    }

    // Get upload status
    uploadData = await page.evaluate(async ({ token, workspace, uploadId }) => {
      const response = await fetch(`/api/workspaces/${workspace}/uploads/${uploadId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get upload status: ${response.statusText}`);
      }

      return response.json();
    }, { token: authToken, workspace: workspaceId, uploadId });

    uploadStatus = uploadData.status;
    
    console.log(`  [${attempts}/${maxAttempts}] Status: ${uploadStatus} | Progress: ${uploadData.progress}%`);
  }

  if (uploadStatus === 'completed') {
    console.log(`✅ Upload completed: ${uploadData.rows_success} rows processed`);
  } else if (uploadStatus === 'failed') {
    console.log(`❌ Upload failed: ${uploadData.error_text || 'Unknown error'}`);
  } else {
    console.log(`⏱️ Upload still processing after ${maxAttempts} attempts`);
  }

  return uploadData;
}

/**
 * Verifies upload appears in the uploads list UI
 * 
 * @param {Page} page - Playwright page object
 * @param {string} workspaceId - Workspace ID
 * @param {string} filename - Filename to look for
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise<boolean>} True if upload is visible
 */
async function verifyUploadInUI(page, workspaceId, filename, timeoutMs = 10000) {
  console.log(`Verifying upload in UI: ${filename}`);

  await page.goto(`https://123ad-performance.launchpulse.ai/w/${workspaceId}/uploads`);

  try {
    await page.waitForSelector(`text=${filename}`, { timeout: timeoutMs });
    console.log(`✅ Upload visible in UI`);
    return true;
  } catch (error) {
    console.log(`❌ Upload not found in UI: ${error.message}`);
    return false;
  }
}

/**
 * Gets all uploads for a workspace
 * 
 * @param {Page} page - Playwright page object
 * @param {string} authToken - Authentication token
 * @param {string} workspaceId - Workspace ID
 * @param {object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @returns {Promise<object>} Uploads list response
 */
async function getUploadsList(page, authToken, workspaceId = 'workspace_001', options = {}) {
  const {
    page: pageNum = 1,
    limit = 10
  } = options;

  const uploadsResponse = await page.evaluate(async ({ token, workspace, page, limit }) => {
    const response = await fetch(`/api/workspaces/${workspace}/uploads?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get uploads list: ${response.statusText}`);
    }

    return response.json();
  }, { token: authToken, workspace: workspaceId, page: pageNum, limit });

  return uploadsResponse;
}

/**
 * Complete workflow: Create upload and wait for completion
 * 
 * @param {Page} page - Playwright page object
 * @param {string} authToken - Authentication token
 * @param {object} options - Upload and polling options
 * @returns {Promise<object>} Final upload status
 */
async function createAndWaitForUpload(page, authToken, options = {}) {
  // Create upload
  const upload = await createTestUpload(page, authToken, options);

  // Wait for completion
  const finalStatus = await pollUploadStatus(
    page,
    authToken,
    upload.id,
    options.workspace_id || 'workspace_001',
    options
  );

  // Optionally verify in UI
  if (options.verifyInUI) {
    await verifyUploadInUI(
      page,
      options.workspace_id || 'workspace_001',
      upload.original_filename
    );
  }

  return finalStatus;
}

// Export functions
module.exports = {
  createTestUpload,
  pollUploadStatus,
  verifyUploadInUI,
  getUploadsList,
  createAndWaitForUpload
};

// Example usage (if run directly)
if (require.main === module) {
  console.log(`
Browser Testing Upload Helper
============================

This module provides helper functions for browser testing without file uploads.

Example Usage:
-------------

const { chromium } = require('playwright');
const { createTestUpload, pollUploadStatus } = require('./browser-test-upload-helper');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Login first...
  await page.goto('https://123ad-performance.launchpulse.ai/signin');
  await page.fill('input[name="email"]', 'john.doe@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/w/workspace_001');
  
  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
  
  // Create test upload
  const upload = await createTestUpload(page, authToken, {
    workspace_id: 'workspace_001',
    platform: 'facebook',
    filename: 'test-upload.csv'
  });
  
  // Poll for completion
  const finalStatus = await pollUploadStatus(page, authToken, upload.id, 'workspace_001');
  
  // Verify in UI
  await verifyUploadInUI(page, 'workspace_001', upload.original_filename);
  
  await browser.close();
})();

Available Functions:
------------------
- createTestUpload(page, authToken, options)
- pollUploadStatus(page, authToken, uploadId, workspaceId, options)
- verifyUploadInUI(page, workspaceId, filename, timeoutMs)
- getUploadsList(page, authToken, workspaceId, options)
- createAndWaitForUpload(page, authToken, options) - All-in-one helper

See BROWSER_TESTING_QUICKSTART.md for more details.
`);
}
