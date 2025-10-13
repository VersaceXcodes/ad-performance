#!/usr/bin/env node

/**
 * Enhanced Browser Testing Validation Script
 * Detects and reports specific browser testing issues
 */

const http = require('http');
const https = require('https');

// Test configurations for both production and local
const PROD_BASE = 'https://123ad-performance.launchpulse.ai';
const LOCAL_BASE = 'http://localhost:3000';

function makeRequest(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (HeadlessChrome/118.0.0.0) Safari/537.36 Browser-Test-Agent',
        'Accept': 'application/json, text/html, */*',
        'X-Automation': 'true',
        'X-Test-Mode': 'browser-validation',
        ...headers
      },
      timeout: 15000,
      rejectUnauthorized: false
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = client.request(options, (res) => {
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

    req.on('error', (error) => {
      reject({
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        code: 'TIMEOUT',
        timeout: true
      });
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function validateJSONResponse(response, endpointName) {
  const issues = [];
  
  // Check if response is valid JSON
  try {
    const parsed = JSON.parse(response.data);
    
    // Check for common API response structure
    if (typeof parsed !== 'object') {
      issues.push(`${endpointName}: Response is not a JSON object`);
    }
    
    // Check for error responses that should include proper structure
    if (response.statusCode >= 400) {
      if (!parsed.success && !parsed.message) {
        issues.push(`${endpointName}: Error response missing proper structure (success/message fields)`);
      }
    }
    
    // Check for successful API responses
    if (response.statusCode < 400 && endpointName.includes('/api/')) {
      // Most API endpoints should have some structured response
      if (Object.keys(parsed).length === 0) {
        issues.push(`${endpointName}: API response is empty object`);
      }
    }
    
  } catch (e) {
    issues.push(`${endpointName}: Invalid JSON response - ${e.message}`);
  }
  
  return issues;
}

async function checkCORSHeaders(response, endpointName, origin) {
  const issues = [];
  const headers = response.headers;
  
  if (!headers['access-control-allow-origin']) {
    issues.push(`${endpointName}: Missing CORS Access-Control-Allow-Origin header`);
  } else if (headers['access-control-allow-origin'] !== origin && headers['access-control-allow-origin'] !== '*') {
    issues.push(`${endpointName}: CORS origin mismatch - Expected: ${origin}, Got: ${headers['access-control-allow-origin']}`);
  }
  
  // Check for other important CORS headers for complex requests
  if (endpointName.includes('POST') || endpointName.includes('PUT') || endpointName.includes('DELETE')) {
    if (!headers['access-control-allow-methods']) {
      issues.push(`${endpointName}: Missing CORS Access-Control-Allow-Methods header for non-GET request`);
    }
    if (!headers['access-control-allow-headers']) {
      issues.push(`${endpointName}: Missing CORS Access-Control-Allow-Headers header for non-GET request`);
    }
  }
  
  return issues;
}

async function testBrowserCompatibility(baseUrl) {
  console.log(`🤖 Testing Browser Compatibility for: ${baseUrl}\n`);
  
  const issues = [];
  const testCases = [
    {
      name: 'Health Check',
      url: `${baseUrl}/health`,
      method: 'GET',
      expectJson: true,
      expectSuccess: true
    },
    {
      name: 'API Status',
      url: `${baseUrl}/api/status`,
      method: 'GET',
      expectJson: true,
      expectSuccess: true
    },
    {
      name: 'Frontend Root',
      url: `${baseUrl}/`,
      method: 'GET',
      expectJson: false,
      expectSuccess: true
    },
    {
      name: 'Browser Test Endpoint',
      url: `${baseUrl}/api/test/browser`,
      method: 'GET',
      expectJson: true,
      expectSuccess: true
    },
    {
      name: 'CORS Preflight - Login',
      url: `${baseUrl}/api/auth/login`,
      method: 'OPTIONS',
      expectJson: false,
      expectSuccess: true,
      headers: {
        'Origin': baseUrl,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization'
      }
    },
    {
      name: 'Invalid JSON Test',
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      body: '{"invalid": json}',
      expectJson: true,
      expectSuccess: false,
      expectedStatus: [400, 500]
    },
    {
      name: 'Authentication Test',
      url: `${baseUrl}/api/auth/me`,
      method: 'GET',
      expectJson: true,
      expectSuccess: false,
      expectedStatus: [401]
    }
  ];

  for (const test of testCases) {
    try {
      console.log(`Testing: ${test.name}...`);
      
      const response = await makeRequest(
        test.url, 
        test.method, 
        test.headers || {}, 
        test.body || null
      );
      
      // Check status code expectations
      if (test.expectSuccess && !response.success) {
        issues.push(`${test.name}: Expected success but got ${response.statusCode}`);
      } else if (!test.expectSuccess && response.success) {
        if (!test.expectedStatus || !test.expectedStatus.includes(response.statusCode)) {
          issues.push(`${test.name}: Expected failure but got success (${response.statusCode})`);
        }
      }
      
      // Check specific expected status codes
      if (test.expectedStatus && !test.expectedStatus.includes(response.statusCode)) {
        issues.push(`${test.name}: Expected status ${test.expectedStatus.join(' or ')}, got ${response.statusCode}`);
      }
      
      // Validate JSON responses
      if (test.expectJson) {
        const jsonIssues = await validateJSONResponse(response, test.name);
        issues.push(...jsonIssues);
      }
      
      // Check CORS headers
      const corsIssues = await checkCORSHeaders(response, test.name, baseUrl);
      issues.push(...corsIssues);
      
      // Check for browser testing compatibility headers
      if (response.headers['x-browser-test']) {
        console.log(`   ✅ Browser test compatibility detected: ${response.headers['x-browser-test']}`);
      }
      
      console.log(`   Status: ${response.statusCode} ${response.success ? '✅' : '❌'}`);
      
    } catch (error) {
      if (error.timeout) {
        issues.push(`${test.name}: Request timeout - server may be unresponsive`);
      } else if (error.code === 'ECONNREFUSED') {
        issues.push(`${test.name}: Connection refused - server may be down`);
      } else if (error.code === 'ENOTFOUND') {
        issues.push(`${test.name}: DNS resolution failed - domain may be invalid`);
      } else if (error.code === 'ECONNRESET') {
        issues.push(`${test.name}: Connection reset - server may have crashed`);
      } else {
        issues.push(`${test.name}: Network error - ${error.error}`);
      }
      console.log(`   ❌ ERROR: ${error.error}`);
    }
    
    console.log('');
  }
  
  return issues;
}

async function testAuthenticationFlow(baseUrl) {
  console.log(`🔐 Testing Authentication Flow: ${baseUrl}\n`);
  
  const issues = [];
  
  try {
    // Test user registration
    console.log('Testing user registration...');
    const registerData = JSON.stringify({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User'
    });
    
    const registerResponse = await makeRequest(
      `${baseUrl}/api/auth/register`,
      'POST',
      {},
      registerData
    );
    
    if (!registerResponse.success) {
      issues.push(`User registration failed: ${registerResponse.statusCode}`);
      console.log(`   ❌ Registration failed: ${registerResponse.statusCode}`);
      return issues; // Can't continue without successful registration
    }
    
    let userData;
    try {
      userData = JSON.parse(registerResponse.data);
    } catch (e) {
      issues.push('User registration response is not valid JSON');
      return issues;
    }
    
    if (!userData.token) {
      issues.push('User registration response missing token');
      return issues;
    }
    
    console.log('   ✅ Registration successful');
    
    // Test authenticated request
    console.log('Testing authenticated request...');
    const authResponse = await makeRequest(
      `${baseUrl}/api/auth/me`,
      'GET',
      { 'Authorization': `Bearer ${userData.token}` }
    );
    
    if (!authResponse.success) {
      issues.push(`Authenticated request failed: ${authResponse.statusCode}`);
    } else {
      console.log('   ✅ Authentication successful');
    }
    
  } catch (error) {
    issues.push(`Authentication flow error: ${error.error || error.message}`);
  }
  
  return issues;
}

async function runEnhancedValidation() {
  console.log('🧪 Enhanced Browser Testing Validation\n');
  console.log('=' .repeat(60));
  
  const allIssues = [];
  
  // Test production environment
  console.log('\n🌐 PRODUCTION ENVIRONMENT TEST\n');
  const prodIssues = await testBrowserCompatibility(PROD_BASE);
  allIssues.push(...prodIssues.map(issue => `[PROD] ${issue}`));
  
  const prodAuthIssues = await testAuthenticationFlow(PROD_BASE);
  allIssues.push(...prodAuthIssues.map(issue => `[PROD AUTH] ${issue}`));
  
  // Test local environment if available
  console.log('\n🏠 LOCAL ENVIRONMENT TEST\n');
  const localIssues = await testBrowserCompatibility(LOCAL_BASE);
  allIssues.push(...localIssues.map(issue => `[LOCAL] ${issue}`));
  
  const localAuthIssues = await testAuthenticationFlow(LOCAL_BASE);
  allIssues.push(...localAuthIssues.map(issue => `[LOCAL AUTH] ${issue}`));
  
  // Report results
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 VALIDATION RESULTS');
  console.log('=' .repeat(60));
  
  if (allIssues.length === 0) {
    console.log('✅ NO ISSUES FOUND');
    console.log('\n🎉 All browser testing functionality is working correctly!');
    console.log('\nThe application is ready for:');
    console.log('  • Automated browser testing (Selenium, Playwright, Puppeteer)');
    console.log('  • Manual browser testing');
    console.log('  • API integration testing');
    console.log('  • Production deployment');
  } else {
    console.log(`❌ ${allIssues.length} ISSUE(S) FOUND:\n`);
    allIssues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    
    console.log('\n🔧 RECOMMENDED FIXES:');
    
    // Analyze issues and provide recommendations
    const hasNetworkIssues = allIssues.some(issue => 
      issue.includes('Connection refused') || 
      issue.includes('DNS resolution failed') ||
      issue.includes('timeout')
    );
    
    const hasCORSIssues = allIssues.some(issue => issue.includes('CORS'));
    const hasJSONIssues = allIssues.some(issue => issue.includes('JSON'));
    const hasAuthIssues = allIssues.some(issue => issue.includes('AUTH'));
    
    if (hasNetworkIssues) {
      console.log('  • Check server connectivity and ensure services are running');
      console.log('  • Verify firewall settings and network configuration');
    }
    
    if (hasCORSIssues) {
      console.log('  • Update CORS configuration in server.ts');
      console.log('  • Ensure production domain is in CORS allowedOrigins');
    }
    
    if (hasJSONIssues) {
      console.log('  • Fix API endpoints to return valid JSON');
      console.log('  • Add proper error handling for JSON parsing');
    }
    
    if (hasAuthIssues) {
      console.log('  • Check authentication endpoints and JWT configuration');
      console.log('  • Verify database connectivity for user operations');
    }
    
    process.exit(1);
  }
}

// Run validation
runEnhancedValidation().catch(console.error);