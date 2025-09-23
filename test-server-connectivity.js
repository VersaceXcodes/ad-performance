#!/usr/bin/env node

/**
 * Comprehensive Server Connectivity Test
 * Tests all critical endpoints and functionality for browser testing compatibility
 */

const axios = require('axios');
const { Pool } = require('pg');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'https://123ad-performance.launchpulse.ai';
const LOCAL_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 10000; // 10 seconds

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
};

const runTest = async (testName, testFn) => {
  testResults.total++;
  try {
    log(`Testing: ${testName}`, 'info');
    await testFn();
    testResults.passed++;
    log(`PASSED: ${testName}`, 'success');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    log(`FAILED: ${testName} - ${error.message}`, 'error');
  }
};

// Test functions
const testDatabaseConnection = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    if (!result.rows[0].current_time) {
      throw new Error('Database query returned no results');
    }
    
    log(`Database time: ${result.rows[0].current_time}`, 'info');
  } finally {
    await pool.end();
  }
};

const testEndpoint = async (url, expectedStatus = 200, method = 'GET', data = null) => {
  const config = {
    method,
    url,
    timeout: TEST_TIMEOUT,
    validateStatus: (status) => status === expectedStatus,
    headers: {
      'User-Agent': 'ServerConnectivityTest/1.0',
      'Accept': 'application/json',
      'X-Automation': 'true'
    }
  };
  
  if (data) {
    config.data = data;
    config.headers['Content-Type'] = 'application/json';
  }
  
  const response = await axios(config);
  
  // Validate JSON response for API endpoints
  if (url.includes('/api/') || url.includes('/health') || url.includes('/ready')) {
    if (!response.headers['content-type']?.includes('application/json')) {
      throw new Error(`Expected JSON response, got: ${response.headers['content-type']}`);
    }
    
    if (typeof response.data !== 'object') {
      throw new Error('Response is not valid JSON object');
    }
  }
  
  return response;
};

const testCORSHeaders = async (baseUrl) => {
  const response = await axios.options(`${baseUrl}/api/auth/login`, {
    headers: {
      'Origin': 'https://123ad-performance.launchpulse.ai',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization'
    },
    timeout: TEST_TIMEOUT
  });
  
  const corsHeaders = {
    'access-control-allow-origin': response.headers['access-control-allow-origin'],
    'access-control-allow-methods': response.headers['access-control-allow-methods'],
    'access-control-allow-headers': response.headers['access-control-allow-headers']
  };
  
  if (!corsHeaders['access-control-allow-origin']) {
    throw new Error('Missing CORS Allow-Origin header');
  }
  
  if (!corsHeaders['access-control-allow-methods']?.includes('POST')) {
    throw new Error('CORS does not allow POST method');
  }
  
  log(`CORS Origin: ${corsHeaders['access-control-allow-origin']}`, 'info');
};

const testAuthenticationFlow = async (baseUrl) => {
  // Test invalid login (should return 400 with proper JSON error)
  try {
    await testEndpoint(`${baseUrl}/api/auth/login`, 400, 'POST', {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    });
  } catch (error) {
    if (!error.message.includes('400')) {
      throw new Error('Authentication endpoint should return 400 for invalid credentials');
    }
  }
  
  // Test missing auth token (should return 401)
  try {
    await testEndpoint(`${baseUrl}/api/auth/me`, 401, 'GET');
  } catch (error) {
    if (!error.message.includes('401')) {
      throw new Error('Protected endpoint should return 401 without auth token');
    }
  }
};

const testStaticFiles = async (baseUrl) => {
  // Test main HTML file
  const htmlResponse = await axios.get(baseUrl, {
    timeout: TEST_TIMEOUT,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  
  if (!htmlResponse.headers['content-type']?.includes('text/html')) {
    throw new Error(`Expected HTML response, got: ${htmlResponse.headers['content-type']}`);
  }
  
  if (!htmlResponse.data.includes('<html') || !htmlResponse.data.includes('</html>')) {
    throw new Error('Response does not appear to be valid HTML');
  }
  
  log('HTML content length: ' + htmlResponse.data.length, 'info');
};

const testErrorHandling = async (baseUrl) => {
  // Test 404 for non-existent API endpoint
  const response = await testEndpoint(`${baseUrl}/api/nonexistent`, 404, 'GET');
  
  if (!response.data.success === false) {
    throw new Error('404 response should have success: false');
  }
  
  if (!response.data.message) {
    throw new Error('404 response should have error message');
  }
  
  if (!response.data.timestamp) {
    throw new Error('404 response should have timestamp');
  }
};

// Main test runner
const runAllTests = async () => {
  log('🚀 Starting Comprehensive Server Connectivity Tests', 'info');
  log(`Testing URLs: ${BASE_URL} and ${LOCAL_URL}`, 'info');
  
  // Test database connection first
  await runTest('Database Connection', testDatabaseConnection);
  
  // Test both production and local URLs
  for (const baseUrl of [BASE_URL, LOCAL_URL]) {
    log(`\n🌐 Testing: ${baseUrl}`, 'info');
    
    try {
      // Basic connectivity tests
      await runTest(`${baseUrl} - Health Check`, () => testEndpoint(`${baseUrl}/health`));
      await runTest(`${baseUrl} - Readiness Check`, () => testEndpoint(`${baseUrl}/ready`));
      await runTest(`${baseUrl} - API Status`, () => testEndpoint(`${baseUrl}/api/status`));
      await runTest(`${baseUrl} - Debug Info`, () => testEndpoint(`${baseUrl}/api/debug`));
      await runTest(`${baseUrl} - Test Validation`, () => testEndpoint(`${baseUrl}/api/test/validate`));
      
      // CORS tests
      await runTest(`${baseUrl} - CORS Headers`, () => testCORSHeaders(baseUrl));
      
      // Authentication tests
      await runTest(`${baseUrl} - Authentication Flow`, () => testAuthenticationFlow(baseUrl));
      
      // Static file tests
      await runTest(`${baseUrl} - Static Files`, () => testStaticFiles(baseUrl));
      
      // Error handling tests
      await runTest(`${baseUrl} - Error Handling`, () => testErrorHandling(baseUrl));
      
    } catch (error) {
      log(`Failed to test ${baseUrl}: ${error.message}`, 'error');
    }
  }
  
  // Print summary
  log('\n📊 Test Results Summary:', 'info');
  log(`Total Tests: ${testResults.total}`, 'info');
  log(`Passed: ${testResults.passed}`, testResults.passed > 0 ? 'success' : 'info');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  
  if (testResults.errors.length > 0) {
    log('\n❌ Failed Tests:', 'error');
    testResults.errors.forEach(({ test, error }) => {
      log(`  - ${test}: ${error}`, 'error');
    });
  }
  
  if (testResults.failed === 0) {
    log('\n🎉 All tests passed! Server is ready for browser testing.', 'success');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please check the errors above.', 'warning');
    process.exit(1);
  }
};

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection: ${reason}`, 'error');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  process.exit(1);
});

// Run tests
runAllTests().catch((error) => {
  log(`Test runner failed: ${error.message}`, 'error');
  process.exit(1);
});