#!/usr/bin/env node

/**
 * Comprehensive Browser Testing Validation Script
 * Tests all critical endpoints and functionality for browser testing compatibility
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://123ad-performance.launchpulse.ai';
const TEST_RESULTS = {
  passed: 0,
  failed: 0,
  tests: []
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (HeadlessChrome/91.0.4472.124) Browser-Test-Validation',
        'Accept': 'application/json, text/html, */*',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`,
        'X-Automation': 'true',
        'X-Test-Mode': 'browser-testing',
        ...options.headers
      },
      timeout: 15000
    };

    if (options.body) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runTest(name, testFunction) {
  console.log(`🧪 Testing: ${name}`);
  try {
    const result = await testFunction();
    if (result.success) {
      console.log(`✅ PASS: ${name}`);
      TEST_RESULTS.passed++;
      TEST_RESULTS.tests.push({ name, status: 'PASS', details: result.details || 'Test passed' });
    } else {
      console.log(`❌ FAIL: ${name} - ${result.error}`);
      TEST_RESULTS.failed++;
      TEST_RESULTS.tests.push({ name, status: 'FAIL', error: result.error });
    }
  } catch (error) {
    console.log(`❌ ERROR: ${name} - ${error.message}`);
    TEST_RESULTS.failed++;
    TEST_RESULTS.tests.push({ name, status: 'ERROR', error: error.message });
  }
  console.log('');
}

// Test Cases
async function testHealthEndpoint() {
  const response = await makeRequest(`${BASE_URL}/health`);
  if (!response.success) {
    return { success: false, error: `Health endpoint returned ${response.statusCode}` };
  }
  
  let healthData;
  try {
    healthData = JSON.parse(response.data);
  } catch (e) {
    return { success: false, error: 'Health endpoint did not return valid JSON' };
  }
  
  if (healthData.status !== 'healthy' && healthData.status !== 'degraded') {
    return { success: false, error: `Unexpected health status: ${healthData.status}` };
  }
  
  return { success: true, details: `Health status: ${healthData.status}, Database: ${healthData.database}` };
}

async function testApiStatus() {
  const response = await makeRequest(`${BASE_URL}/api/status`);
  if (!response.success) {
    return { success: false, error: `API status returned ${response.statusCode}` };
  }
  
  let statusData;
  try {
    statusData = JSON.parse(response.data);
  } catch (e) {
    return { success: false, error: 'API status did not return valid JSON' };
  }
  
  if (!statusData.success) {
    return { success: false, error: `API not running: ${statusData.message}` };
  }
  
  return { success: true, details: `API running, Database: ${statusData.database}` };
}

async function testFrontendServing() {
  const response = await makeRequest(`${BASE_URL}/`);
  if (!response.success) {
    return { success: false, error: `Frontend returned ${response.statusCode}` };
  }
  
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('text/html')) {
    return { success: false, error: `Expected HTML, got: ${contentType}` };
  }
  
  if (!response.data.includes('<html') || !response.data.includes('</html>')) {
    return { success: false, error: 'Response does not contain valid HTML structure' };
  }
  
  return { success: true, details: 'Frontend serving HTML correctly' };
}

async function testCorsHeaders() {
  const response = await makeRequest(`${BASE_URL}/api/debug`, {
    method: 'OPTIONS',
    headers: {
      'Origin': BASE_URL,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type,Authorization'
    }
  });
  
  if (!response.success) {
    return { success: false, error: `CORS preflight failed with ${response.statusCode}` };
  }
  
  return { success: true, details: 'CORS preflight request successful' };
}

async function testAuthenticationErrorHandling() {
  const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'nonexistent@example.com',
      password: 'wrongpassword'
    })
  });
  
  if (response.statusCode !== 400) {
    return { success: false, error: `Expected 400, got ${response.statusCode}` };
  }
  
  let errorData;
  try {
    errorData = JSON.parse(response.data);
  } catch (e) {
    return { success: false, error: 'Auth error did not return valid JSON' };
  }
  
  if (errorData.success !== false || !errorData.error_code) {
    return { success: false, error: 'Auth error response format incorrect' };
  }
  
  return { success: true, details: `Auth error handled correctly: ${errorData.error_code}` };
}

async function testJsonResponseConsistency() {
  const endpoints = [
    '/api/status',
    '/health',
    '/ready',
    '/api/debug'
  ];
  
  for (const endpoint of endpoints) {
    const response = await makeRequest(`${BASE_URL}${endpoint}`);
    if (!response.success) {
      return { success: false, error: `${endpoint} returned ${response.statusCode}` };
    }
    
    try {
      JSON.parse(response.data);
    } catch (e) {
      return { success: false, error: `${endpoint} did not return valid JSON` };
    }
    
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return { success: false, error: `${endpoint} has incorrect content-type: ${contentType}` };
    }
  }
  
  return { success: true, details: 'All API endpoints return valid JSON with correct headers' };
}

async function testBrowserTestingEndpoint() {
  const response = await makeRequest(`${BASE_URL}/api/test/validate`);
  if (!response.success) {
    return { success: false, error: `Browser testing endpoint returned ${response.statusCode}` };
  }
  
  let testData;
  try {
    testData = JSON.parse(response.data);
  } catch (e) {
    return { success: false, error: 'Browser testing endpoint did not return valid JSON' };
  }
  
  if (!testData.tests || !testData.tests.cors || !testData.tests.json_response) {
    return { success: false, error: 'Browser testing endpoint missing required test results' };
  }
  
  return { success: true, details: `Browser testing validation complete: ${testData.tests.cors.status}` };
}

async function testSpaRouting() {
  const response = await makeRequest(`${BASE_URL}/signin`);
  if (!response.success) {
    return { success: false, error: `SPA route returned ${response.statusCode}` };
  }
  
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('text/html')) {
    return { success: false, error: `SPA route should return HTML, got: ${contentType}` };
  }
  
  return { success: true, details: 'SPA routing working correctly' };
}

async function testTimeoutHandling() {
  // This test checks that the server responds within reasonable time
  const startTime = Date.now();
  const response = await makeRequest(`${BASE_URL}/api/debug`);
  const responseTime = Date.now() - startTime;
  
  if (!response.success) {
    return { success: false, error: `Debug endpoint failed: ${response.statusCode}` };
  }
  
  if (responseTime > 10000) {
    return { success: false, error: `Response too slow: ${responseTime}ms` };
  }
  
  return { success: true, details: `Response time: ${responseTime}ms` };
}

async function runAllTests() {
  console.log('🚀 Starting Browser Testing Validation');
  console.log('=' .repeat(60));
  console.log(`Testing URL: ${BASE_URL}`);
  console.log('');

  await runTest('Health Endpoint', testHealthEndpoint);
  await runTest('API Status', testApiStatus);
  await runTest('Frontend Serving', testFrontendServing);
  await runTest('CORS Headers', testCorsHeaders);
  await runTest('Authentication Error Handling', testAuthenticationErrorHandling);
  await runTest('JSON Response Consistency', testJsonResponseConsistency);
  await runTest('Browser Testing Endpoint', testBrowserTestingEndpoint);
  await runTest('SPA Routing', testSpaRouting);
  await runTest('Response Time', testTimeoutHandling);

  console.log('=' .repeat(60));
  console.log('🎯 VALIDATION RESULTS');
  console.log(`✅ Tests Passed: ${TEST_RESULTS.passed}`);
  console.log(`❌ Tests Failed: ${TEST_RESULTS.failed}`);
  console.log(`📊 Success Rate: ${Math.round((TEST_RESULTS.passed / (TEST_RESULTS.passed + TEST_RESULTS.failed)) * 100)}%`);
  
  if (TEST_RESULTS.failed > 0) {
    console.log('\n🔍 FAILED TESTS:');
    TEST_RESULTS.tests
      .filter(test => test.status !== 'PASS')
      .forEach(test => console.log(`  - ${test.name}: ${test.error}`));
  }
  
  console.log('\n🎉 Browser Testing Validation Complete!');
  
  if (TEST_RESULTS.failed === 0) {
    console.log('✨ All tests passed! The application is ready for browser testing.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

runAllTests().catch(console.error);