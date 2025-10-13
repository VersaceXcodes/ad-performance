#!/usr/bin/env node

/**
 * Browser Testing Validation Script
 * Validates all the fixes for browser testing issues
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://123ad-performance.launchpulse.ai';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const defaultOptions = {
      timeout: 15000,
      headers: {
        'User-Agent': 'HeadlessChrome/91.0 (Browser Testing Validation)',
        'X-Automation': 'true',
        'X-Test-Mode': 'browser-testing',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    const req = client.request(url, finalOptions, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
            rawData: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runTests() {
  log('\n🔍 Browser Testing Issues Validation', 'bold');
  log('=========================================', 'blue');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Frontend Loading
  try {
    log('\n📄 Test 1: Frontend Loading', 'blue');
    const response = await makeRequest(BASE_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    if (response.statusCode === 200 && response.rawData.includes('<html')) {
      log('✅ Frontend loads successfully', 'green');
      results.passed++;
    } else {
      log('❌ Frontend failed to load', 'red');
      results.failed++;
    }
    results.tests.push({ name: 'Frontend Loading', status: response.statusCode === 200 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Frontend loading error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Frontend Loading', status: 'FAIL', error: error.message });
  }

  // Test 2: API Health Endpoint (both /health and /api/health)
  log('\n🏥 Test 2: API Health Endpoints', 'blue');
  
  try {
    const healthResponse = await makeRequest(`${BASE_URL}/health`);
    if (healthResponse.statusCode === 200 && healthResponse.data?.status) {
      log('✅ /health endpoint working', 'green');
      results.passed++;
    } else {
      log('❌ /health endpoint failed', 'red');
      results.failed++;
    }
    results.tests.push({ name: '/health endpoint', status: healthResponse.statusCode === 200 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ /health endpoint error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: '/health endpoint', status: 'FAIL', error: error.message });
  }

  // Test 3: API Status Endpoint
  try {
    log('\n📊 Test 3: API Status Endpoint', 'blue');
    const statusResponse = await makeRequest(`${BASE_URL}/api/status`);
    
    if (statusResponse.statusCode === 200 && statusResponse.data?.success) {
      log('✅ /api/status endpoint working', 'green');
      results.passed++;
    } else {
      log('❌ /api/status endpoint failed', 'red');
      results.failed++;
    }
    results.tests.push({ name: '/api/status endpoint', status: statusResponse.statusCode === 200 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ /api/status endpoint error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: '/api/status endpoint', status: 'FAIL', error: error.message });
  }

  // Test 4: CORS Headers
  try {
    log('\n🌐 Test 4: CORS Configuration', 'blue');
    const corsResponse = await makeRequest(`${BASE_URL}/api/debug`, {
      headers: {
        'Origin': 'https://test-browser.example.com',
        'X-Automation': 'true'
      }
    });
    
    const corsHeaders = corsResponse.headers['access-control-allow-credentials'] || 
                       corsResponse.headers['Access-Control-Allow-Credentials'];
    
    if (corsHeaders) {
      log('✅ CORS headers properly configured', 'green');
      results.passed++;
    } else {
      log('❌ CORS headers missing', 'red');
      results.failed++;
    }
    results.tests.push({ name: 'CORS Configuration', status: corsHeaders ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ CORS test error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'CORS Configuration', status: 'FAIL', error: error.message });
  }

  // Test 5: JSON Response Format
  try {
    log('\n📦 Test 5: JSON Response Format', 'blue');
    const jsonResponse = await makeRequest(`${BASE_URL}/api/test/validate`);
    
    if (jsonResponse.statusCode === 200 && 
        jsonResponse.data && 
        typeof jsonResponse.data === 'object' &&
        jsonResponse.data.success !== undefined) {
      log('✅ JSON responses properly formatted', 'green');
      results.passed++;
    } else {
      log('❌ JSON response format invalid', 'red');
      results.failed++;
    }
    results.tests.push({ name: 'JSON Response Format', status: jsonResponse.data ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ JSON format test error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'JSON Response Format', status: 'FAIL', error: error.message });
  }

  // Test 6: Authentication Endpoints
  try {
    log('\n🔐 Test 6: Authentication Endpoints', 'blue');
    const authResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: {
        email: 'test@nonexistent.com',
        password: 'testpass'
      }
    });
    
    // Should return 400 with proper error format, not 502
    if (authResponse.statusCode === 400 && authResponse.data?.success === false) {
      log('✅ Authentication endpoint responding correctly', 'green');
      results.passed++;
    } else {
      log(`❌ Authentication endpoint issue (status: ${authResponse.statusCode})`, 'red');
      results.failed++;
    }
    results.tests.push({ name: 'Authentication Endpoints', status: authResponse.statusCode === 400 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Authentication test error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Authentication Endpoints', status: 'FAIL', error: error.message });
  }

  // Test 7: Browser Testing Headers Recognition
  try {
    log('\n🤖 Test 7: Browser Testing Headers', 'blue');
    const browserResponse = await makeRequest(`${BASE_URL}/api/test/connectivity`);
    
    const browserTestHeader = browserResponse.headers['x-browser-test'] || 
                             browserResponse.headers['X-Browser-Test'];
    
    if (browserTestHeader && browserResponse.statusCode === 200) {
      log('✅ Browser testing headers recognized', 'green');
      results.passed++;
    } else {
      log('❌ Browser testing headers not recognized', 'red');
      results.failed++;
    }
    results.tests.push({ name: 'Browser Testing Headers', status: browserTestHeader ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Browser testing headers error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Browser Testing Headers', status: 'FAIL', error: error.message });
  }

  // Test 8: Database Connectivity
  try {
    log('\n🗄️  Test 8: Database Connectivity', 'blue');
    const dbResponse = await makeRequest(`${BASE_URL}/api/test/validate`);
    
    if (dbResponse.statusCode === 200 && 
        dbResponse.data?.tests?.database?.status === 'pass') {
      log('✅ Database connectivity working', 'green');
      results.passed++;
    } else {
      log('❌ Database connectivity issues', 'red');
      results.failed++;
    }
    results.tests.push({ name: 'Database Connectivity', status: dbResponse.data?.tests?.database?.status === 'pass' ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Database connectivity error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Database Connectivity', status: 'FAIL', error: error.message });
  }

  // Test 9: Request Timeout Handling
  try {
    log('\n⏱️  Test 9: Request Timeout Handling', 'blue');
    const timeoutResponse = await makeRequest(`${BASE_URL}/api/debug`, {
      timeout: 5000 // 5 second timeout
    });
    
    if (timeoutResponse.statusCode === 200) {
      log('✅ Request timeout handling working', 'green');
      results.passed++;
    } else {
      log(`❌ Request timeout issues (status: ${timeoutResponse.statusCode})`, 'red');
      results.failed++;
    }
    results.tests.push({ name: 'Request Timeout Handling', status: timeoutResponse.statusCode === 200 ? 'PASS' : 'FAIL' });
  } catch (error) {
    if (error.message.includes('timeout')) {
      log('❌ Server response too slow', 'red');
    } else {
      log(`❌ Timeout handling error: ${error.message}`, 'red');
    }
    results.failed++;
    results.tests.push({ name: 'Request Timeout Handling', status: 'FAIL', error: error.message });
  }

  // Test 10: Error Response Format
  try {
    log('\n🚨 Test 10: Error Response Format', 'blue');
    const errorResponse = await makeRequest(`${BASE_URL}/api/nonexistent-endpoint`);
    
    if (errorResponse.statusCode === 404 && 
        errorResponse.data?.success === false &&
        errorResponse.data?.timestamp) {
      log('✅ Error responses properly formatted', 'green');
      results.passed++;
    } else {
      log('❌ Error response format issues', 'red');
      results.failed++;
    }
    results.tests.push({ name: 'Error Response Format', status: errorResponse.data?.success === false ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Error response test error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Error Response Format', status: 'FAIL', error: error.message });
  }

  // Summary
  log('\n📋 Test Results Summary', 'bold');
  log('======================', 'blue');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`📊 Total: ${results.passed + results.failed}`, 'blue');
  
  const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
  log(`🎯 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

  if (results.failed === 0) {
    log('\n🎉 All browser testing fixes are working correctly!', 'green');
  } else if (results.failed <= 2) {
    log('\n⚠️  Most fixes are working, but some issues remain.', 'yellow');
  } else {
    log('\n💥 Several issues still need to be addressed.', 'red');
  }

  // Detailed results
  log('\n📄 Detailed Results:', 'bold');
  results.tests.forEach(test => {
    const status = test.status === 'PASS' ? '✅' : '❌';
    const color = test.status === 'PASS' ? 'green' : 'red';
    log(`${status} ${test.name}: ${test.status}`, color);
    if (test.error) {
      log(`   Error: ${test.error}`, 'yellow');
    }
  });

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the validation
if (require.main === module) {
  runTests().catch(error => {
    log(`\n💥 Validation script error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runTests, makeRequest };