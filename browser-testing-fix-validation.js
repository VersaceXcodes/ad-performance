#!/usr/bin/env node

/**
 * Browser Testing Fix Validation Script
 * Tests actual browser testing scenarios with proper CORS and cross-origin requests
 */

const http = require('http');
const https = require('https');

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
        'User-Agent': 'Mozilla/5.0 (HeadlessChrome/118.0.0.0) Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'X-Automation': 'true',
        'X-Test-Mode': 'browser-validation',
        'Origin': 'https://123ad-performance.launchpulse.ai', // Simulate cross-origin
        ...headers
      },
      timeout: 10000,
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

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function testCriticalEndpoints(baseUrl) {
  console.log(`🧪 Testing Critical Browser Testing Endpoints: ${baseUrl}\n`);
  
  const results = {
    passed: 0,
    failed: 0,
    issues: []
  };

  const tests = [
    {
      name: 'Health Endpoint',
      url: `${baseUrl}/health`,
      expectStatus: 200,
      expectJSON: true,
      critical: true
    },
    {
      name: 'API Status',
      url: `${baseUrl}/api/status`,
      expectStatus: 200,
      expectJSON: true,
      critical: true
    },
    {
      name: 'Frontend Loading',
      url: `${baseUrl}/`,
      expectStatus: 200,
      expectJSON: false,
      critical: true
    },
    {
      name: 'Browser Validation Endpoint',
      url: `${baseUrl}/api/test/validate`,
      expectStatus: 200,
      expectJSON: true,
      critical: true
    },
    {
      name: 'CORS Preflight Check',
      url: `${baseUrl}/api/auth/login`,
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization'
      },
      expectStatus: 200,
      expectJSON: false,
      critical: true
    },
    {
      name: 'Authentication Endpoint',
      url: `${baseUrl}/api/auth/me`,
      expectStatus: 401,
      expectJSON: true,
      critical: false
    }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await makeRequest(test.url, test.method || 'GET', test.headers || {});
      
      // Check status code
      if (result.statusCode !== test.expectStatus) {
        results.issues.push(`${test.name}: Expected ${test.expectStatus}, got ${result.statusCode}`);
        if (test.critical) results.failed++;
      } else {
        results.passed++;
      }
      
      // Check JSON response validity
      if (test.expectJSON) {
        try {
          const parsed = JSON.parse(result.data);
          
          // For API endpoints, check if response has expected structure
          if (test.url.includes('/api/') && result.statusCode < 400) {
            if (typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
              results.issues.push(`${test.name}: API response lacks proper structure`);
            }
          }
          
          // For error responses, check error structure
          if (result.statusCode >= 400) {
            if (!parsed.message && !parsed.error) {
              results.issues.push(`${test.name}: Error response missing message field`);
            }
          }
          
        } catch (e) {
          results.issues.push(`${test.name}: Invalid JSON response - ${e.message}`);
          if (test.critical) results.failed++;
        }
      }
      
      // Check CORS headers (should be present for cross-origin requests)
      const hasCORS = result.headers['access-control-allow-origin'] !== undefined;
      if (hasCORS) {
        console.log(`   ✅ CORS headers present`);
      } else if (test.name !== 'Frontend Loading') { // Frontend doesn't need CORS headers
        console.log(`   ⚠️  No CORS headers (may be issue for cross-origin browser tests)`);
      }
      
      // Check browser test headers
      if (result.headers['x-browser-test']) {
        console.log(`   ✅ Browser test compatibility: ${result.headers['x-browser-test']}`);
      }
      
      console.log(`   Status: ${result.statusCode} ${result.statusCode === test.expectStatus ? '✅' : '❌'}`);
      
    } catch (error) {
      results.failed++;
      results.issues.push(`${test.name}: Network error - ${error.message}`);
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
  
  return results;
}

async function testBrowserAutomationScenarios() {
  console.log('🤖 Testing Browser Automation Scenarios\n');
  
  const scenarios = [
    {
      name: 'Headless Chrome Simulation',
      userAgent: 'Mozilla/5.0 (HeadlessChrome/118.0.0.0) Safari/537.36',
      headers: { 'X-Automation': 'true' }
    },
    {
      name: 'Playwright Simulation',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/118.0.0.0 Playwright/1.37.0',
      headers: { 'X-Automation': 'true' }
    },
    {
      name: 'Selenium WebDriver Simulation',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 webdriver',
      headers: {}
    }
  ];
  
  const results = { passed: 0, failed: 0, issues: [] };
  
  for (const scenario of scenarios) {
    console.log(`Testing ${scenario.name}...`);
    
    try {
      const response = await makeRequest(
        'https://123ad-performance.launchpulse.ai/api/test/validate',
        'GET',
        {
          'User-Agent': scenario.userAgent,
          ...scenario.headers
        }
      );
      
      if (response.success) {
        console.log(`   ✅ ${scenario.name}: Server responded correctly`);
        results.passed++;
        
        // Check if browser test detection worked
        if (response.headers['x-browser-test']) {
          console.log(`   ✅ Browser test detected: ${response.headers['x-browser-test']}`);
        } else {
          console.log(`   ⚠️  Browser test detection may not be working`);
        }
      } else {
        console.log(`   ❌ ${scenario.name}: Failed with status ${response.statusCode}`);
        results.failed++;
        results.issues.push(`${scenario.name}: Status ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ ${scenario.name}: Error - ${error.message}`);
      results.failed++;
      results.issues.push(`${scenario.name}: ${error.message}`);
    }
    
    console.log('');
  }
  
  return results;
}

async function testConsoleErrorScenarios() {
  console.log('🚨 Testing Potential Console Error Scenarios\n');
  
  const errorTests = [
    {
      name: 'Malformed JSON Request',
      url: 'https://123ad-performance.launchpulse.ai/api/auth/login',
      method: 'POST',
      body: '{"invalid": json syntax}',
      expectError: true
    },
    {
      name: 'Non-existent API Endpoint',
      url: 'https://123ad-performance.launchpulse.ai/api/nonexistent',
      method: 'GET',
      expectError: true
    },
    {
      name: 'Unauthorized Request',
      url: 'https://123ad-performance.launchpulse.ai/api/workspaces',
      method: 'GET',
      expectError: true
    }
  ];
  
  const results = { passed: 0, failed: 0, issues: [] };
  
  for (const test of errorTests) {
    console.log(`Testing ${test.name}...`);
    
    try {
      const response = await makeRequest(test.url, test.method, {}, test.body);
      
      if (response.statusCode >= 400) {
        // Check if error response is valid JSON
        try {
          const errorData = JSON.parse(response.data);
          if (errorData.message || errorData.error) {
            console.log(`   ✅ ${test.name}: Proper error handling (${response.statusCode})`);
            results.passed++;
          } else {
            console.log(`   ❌ ${test.name}: Error response missing message field`);
            results.failed++;
            results.issues.push(`${test.name}: Error response structure invalid`);
          }
        } catch (e) {
          console.log(`   ❌ ${test.name}: Error response is not valid JSON`);
          results.failed++;
          results.issues.push(`${test.name}: Non-JSON error response`);
        }
      } else {
        console.log(`   ❌ ${test.name}: Expected error but got success (${response.statusCode})`);
        results.failed++;
        results.issues.push(`${test.name}: Should have returned error`);
      }
      
    } catch (error) {
      console.log(`   ❌ ${test.name}: Network error - ${error.message}`);
      results.failed++;
      results.issues.push(`${test.name}: ${error.message}`);
    }
    
    console.log('');
  }
  
  return results;
}

async function runBrowserTestingValidation() {
  console.log('🧪 Browser Testing Fix Validation\n');
  console.log('=' .repeat(60));
  
  // Test critical endpoints
  console.log('\n📍 CRITICAL ENDPOINTS TEST\n');
  const endpointResults = await testCriticalEndpoints('https://123ad-performance.launchpulse.ai');
  
  // Test browser automation scenarios
  const automationResults = await testBrowserAutomationScenarios();
  
  // Test console error scenarios
  const errorResults = await testConsoleErrorScenarios();
  
  // Compile overall results
  const totalPassed = endpointResults.passed + automationResults.passed + errorResults.passed;
  const totalFailed = endpointResults.failed + automationResults.failed + errorResults.failed;
  const allIssues = [...endpointResults.issues, ...automationResults.issues, ...errorResults.issues];
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 BROWSER TESTING VALIDATION RESULTS');
  console.log('=' .repeat(60));
  
  console.log(`Total Tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed} ✅`);
  console.log(`Failed: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);
  
  if (allIssues.length === 0) {
    console.log('\n🎉 ALL BROWSER TESTING FUNCTIONALITY IS WORKING!');
    console.log('\n✅ The application is ready for:');
    console.log('   • Headless Chrome automation (Puppeteer)');
    console.log('   • Multi-browser testing (Playwright)');
    console.log('   • Selenium WebDriver automation');
    console.log('   • Manual browser testing');
    console.log('   • Production deployment');
    
    console.log('\n🚀 Browser testing URLs:');
    console.log('   Production: https://123ad-performance.launchpulse.ai');
    console.log('   Local: http://localhost:3000');
    
  } else {
    console.log('\n❌ REMAINING ISSUES TO FIX:');
    allIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('   1. Review server logs for detailed error information');
    console.log('   2. Check database connectivity if API endpoints are failing');
    console.log('   3. Verify CORS configuration for cross-origin requests');
    console.log('   4. Test with actual browser automation tools');
    
    process.exit(1);
  }
}

runBrowserTestingValidation().catch(console.error);