#!/usr/bin/env node

/**
 * Frontend Browser Testing Simulation
 * Simulates browser behavior to test frontend functionality
 */

const https = require('https');

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
    const defaultOptions = {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'X-Automation': 'true',
        'X-Test-Mode': 'browser-testing'
      }
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    const req = https.request(url, finalOptions, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
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

async function simulateBrowserTest() {
  log('\n🌐 Frontend Browser Testing Simulation', 'bold');
  log('======================================', 'blue');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Homepage Load
  try {
    log('\n🏠 Test 1: Homepage Loading', 'blue');
    const response = await makeRequest(BASE_URL);
    
    const hasHTML = response.data.includes('<html');
    const hasTitle = response.data.includes('<title>');
    const hasReactDiv = response.data.includes('id="root"') || response.data.includes('id="app"');
    const hasJS = response.data.includes('.js"') || response.data.includes('type="module"');
    
    if (response.statusCode === 200 && hasHTML && hasReactDiv) {
      log('✅ Homepage loads with React app structure', 'green');
      results.passed++;
    } else {
      log(`❌ Homepage issues (status: ${response.statusCode})`, 'red');
      if (!hasHTML) log('  - Missing HTML structure', 'red');
      if (!hasReactDiv) log('  - Missing React root div', 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'Homepage Loading', status: response.statusCode === 200 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Homepage error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Homepage Loading', status: 'FAIL', error: error.message });
  }

  // Test 2: API Integration Test
  try {
    log('\n🔌 Test 2: API Integration', 'blue');
    
    // Simulate what the frontend would do - check API health first
    const healthCheck = await makeRequest(`${BASE_URL}/api/status`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const healthData = JSON.parse(healthCheck.data);
    
    if (healthCheck.statusCode === 200 && healthData.success) {
      log('✅ API integration working (health check passed)', 'green');
      results.passed++;
    } else {
      log('❌ API integration failed', 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'API Integration', status: healthCheck.statusCode === 200 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ API integration error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'API Integration', status: 'FAIL', error: error.message });
  }

  // Test 3: Authentication Flow Simulation
  try {
    log('\n🔐 Test 3: Authentication Flow', 'blue');
    
    // Simulate invalid login attempt (what frontend would do)
    const loginResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: 'browser-test@example.com',
        password: 'invalid-password'
      })
    });
    
    const loginData = JSON.parse(loginResponse.data);
    
    // Should get proper error response, not server error
    if (loginResponse.statusCode === 400 && 
        loginData.success === false && 
        loginData.error_code === 'INVALID_CREDENTIALS') {
      log('✅ Authentication flow working (proper error handling)', 'green');
      results.passed++;
    } else {
      log(`❌ Authentication flow issues (status: ${loginResponse.statusCode})`, 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'Authentication Flow', status: loginResponse.statusCode === 400 ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Authentication flow error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Authentication Flow', status: 'FAIL', error: error.message });
  }

  // Test 4: Browser-Specific Headers
  try {
    log('\n🤖 Test 4: Browser Detection', 'blue');
    
    const browserResponse = await makeRequest(`${BASE_URL}/api/test/connectivity`);
    const responseData = JSON.parse(browserResponse.data);
    
    const browserDetected = browserResponse.headers['x-browser-test'] || 
                           browserResponse.headers['X-Browser-Test'] ||
                           responseData.request_info?.x_automation === 'true';
    
    if (browserResponse.statusCode === 200 && browserDetected) {
      log('✅ Browser testing environment detected correctly', 'green');
      results.passed++;
    } else {
      log('❌ Browser detection issues', 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'Browser Detection', status: browserDetected ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Browser detection error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Browser Detection', status: 'FAIL', error: error.message });
  }

  // Test 5: Static Asset Loading
  try {
    log('\n📦 Test 5: Static Assets', 'blue');
    
    // Get the homepage to extract asset URLs
    const homepageResponse = await makeRequest(BASE_URL);
    const homepage = homepageResponse.data;
    
    // Extract JS file from HTML
    const jsMatch = homepage.match(/src="([^"]*\.js)"/);
    const cssMatch = homepage.match(/href="([^"]*\.css)"/);
    
    let assetsWorking = true;
    
    if (jsMatch) {
      const jsUrl = jsMatch[1].startsWith('/') ? `${BASE_URL}${jsMatch[1]}` : jsMatch[1];
      try {
        const jsResponse = await makeRequest(jsUrl);
        if (jsResponse.statusCode !== 200) {
          log('❌ JS asset failed to load', 'red');
          assetsWorking = false;
        }
      } catch (e) {
        log('❌ JS asset load error', 'red');
        assetsWorking = false;
      }
    }
    
    if (cssMatch) {
      const cssUrl = cssMatch[1].startsWith('/') ? `${BASE_URL}${cssMatch[1]}` : cssMatch[1];
      try {
        const cssResponse = await makeRequest(cssUrl);
        if (cssResponse.statusCode !== 200) {
          log('❌ CSS asset failed to load', 'red');
          assetsWorking = false;
        }
      } catch (e) {
        log('❌ CSS asset load error', 'red');
        assetsWorking = false;
      }
    }
    
    if (assetsWorking) {
      log('✅ Static assets loading correctly', 'green');
      results.passed++;
    } else {
      log('❌ Static asset issues', 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'Static Assets', status: assetsWorking ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Static assets test error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Static Assets', status: 'FAIL', error: error.message });
  }

  // Test 6: CORS Preflight
  try {
    log('\n🌍 Test 6: CORS Preflight', 'blue');
    
    const preflightResponse = await makeRequest(`${BASE_URL}/api/auth/me`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://browser-test.example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });
    
    const allowOrigin = preflightResponse.headers['access-control-allow-origin'];
    const allowMethods = preflightResponse.headers['access-control-allow-methods'];
    
    if (preflightResponse.statusCode === 200 && (allowOrigin || allowMethods)) {
      log('✅ CORS preflight working', 'green');
      results.passed++;
    } else {
      log('❌ CORS preflight issues', 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'CORS Preflight', status: (allowOrigin || allowMethods) ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ CORS preflight error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'CORS Preflight', status: 'FAIL', error: error.message });
  }

  // Test 7: Error Handling
  try {
    log('\n🚨 Test 7: Error Handling', 'blue');
    
    // Test 404 error
    const notFoundResponse = await makeRequest(`${BASE_URL}/api/nonexistent`);
    const errorData = JSON.parse(notFoundResponse.data);
    
    const properErrorFormat = errorData.success === false && 
                              errorData.message && 
                              errorData.timestamp;
    
    if (notFoundResponse.statusCode === 404 && properErrorFormat) {
      log('✅ Error handling working correctly', 'green');
      results.passed++;
    } else {
      log('❌ Error handling issues', 'red');
      results.failed++;
    }
    
    results.tests.push({ name: 'Error Handling', status: properErrorFormat ? 'PASS' : 'FAIL' });
  } catch (error) {
    log(`❌ Error handling test error: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({ name: 'Error Handling', status: 'FAIL', error: error.message });
  }

  // Summary
  log('\n📊 Browser Testing Simulation Results', 'bold');
  log('=====================================', 'blue');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`📈 Total: ${results.passed + results.failed}`, 'blue');
  
  const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
  log(`🎯 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

  if (results.failed === 0) {
    log('\n🎉 All browser functionality tests passed!', 'green');
    log('The application is ready for browser testing.', 'green');
  } else if (results.failed <= 1) {
    log('\n⚠️  Most functionality working, minor issues remain.', 'yellow');
  } else {
    log('\n💥 Several browser functionality issues need attention.', 'red');
  }

  // Detailed results
  log('\n📋 Test Details:', 'bold');
  results.tests.forEach(test => {
    const status = test.status === 'PASS' ? '✅' : '❌';
    const color = test.status === 'PASS' ? 'green' : 'red';
    log(`${status} ${test.name}: ${test.status}`, color);
  });

  return results.failed === 0;
}

// Run the simulation
if (require.main === module) {
  simulateBrowserTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    log(`\n💥 Browser simulation error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { simulateBrowserTest };