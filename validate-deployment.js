#!/usr/bin/env node

const https = require('https');
const http = require('http');

const DEPLOYMENT_URL = 'https://123ad-performance.launchpulse.ai';

console.log('🔍 Validating deployment at:', DEPLOYMENT_URL);

async function validateDeployment() {
  const endpoints = [
    { path: '/health', critical: true },
    { path: '/api/status', critical: true },
    { path: '/api/test/validate', critical: false },
    { path: '/api/test/connectivity', critical: false },
    { path: '/api/test/browser', critical: false },
    { path: '/', critical: true }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedCritical = [];

  console.log('\n📊 Testing endpoints...\n');

  for (const endpoint of endpoints) {
    totalTests++;
    try {
      const result = await testUrl(DEPLOYMENT_URL + endpoint.path);
      console.log(`✅ ${endpoint.path} - Status: ${result.status}, Response Time: ${result.responseTime}ms`);
      
      if (endpoint.path === '/health' && result.data) {
        try {
          const healthData = JSON.parse(result.data);
          console.log(`   📋 Health Status: ${healthData.status}`);
          console.log(`   💾 Database: ${healthData.database}`);
          console.log(`   📁 Static Files: ${healthData.checks?.static_files ? '✅' : '❌'}`);
        } catch (e) {
          console.log('   ⚠️  Health response not JSON');
        }
      }
      
      passedTests++;
    } catch (error) {
      const symbol = endpoint.critical ? '❌' : '⚠️';
      console.log(`${symbol} ${endpoint.path} - ERROR: ${error.message}`);
      
      if (endpoint.critical) {
        failedCritical.push(endpoint.path);
      }
    }
  }

  console.log(`\n📊 Test Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (failedCritical.length > 0) {
    console.log(`\n🚨 Critical failures detected:`);
    failedCritical.forEach(endpoint => console.log(`   - ${endpoint}`));
    console.log('\n💡 Recommendations:');
    console.log('   1. Check if the application is deployed and running');
    console.log('   2. Verify environment variables are set correctly');
    console.log('   3. Check database connection');
    console.log('   4. Review server logs for errors');
    process.exit(1);
  } else {
    console.log('\n🎉 All critical tests passed! Deployment appears healthy.');
    
    if (passedTests === totalTests) {
      console.log('✨ Perfect! All tests passed.');
    } else {
      console.log('⚠️  Some non-critical tests failed, but core functionality is working.');
    }
  }
}

function testUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;

    const req = client.get(url, {
      timeout: timeout,
      headers: {
        'User-Agent': 'DeploymentValidator/1.0',
        'Accept': 'application/json,text/html,*/*'
      }
    }, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({
            status: res.statusCode,
            responseTime: responseTime,
            data: data,
            headers: res.headers
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode} - ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(timeout);
  });
}

// Run validation
validateDeployment().catch((error) => {
  console.error('\n💥 Validation failed:', error.message);
  process.exit(1);
});