#!/usr/bin/env node

// Production endpoint testing script
const https = require('https');

const PRODUCTION_URL = 'https://123ad-performance.launchpulse.ai';

const testEndpoints = [
  { name: 'Frontend Root', url: `${PRODUCTION_URL}/`, method: 'GET', expectHtml: true },
  { name: 'Health Check', url: `${PRODUCTION_URL}/health`, method: 'GET' },
  { name: 'API Status', url: `${PRODUCTION_URL}/api/status`, method: 'GET' },
  { name: 'API Debug', url: `${PRODUCTION_URL}/api/debug`, method: 'GET' },
  { name: 'API Validation', url: `${PRODUCTION_URL}/api/test/validate`, method: 'GET' },
  { name: 'Ready Probe', url: `${PRODUCTION_URL}/ready`, method: 'GET' },
  { name: 'CORS Preflight', url: `${PRODUCTION_URL}/api/auth/login`, method: 'OPTIONS' },
  { name: 'Login Endpoint', url: `${PRODUCTION_URL}/api/auth/login`, method: 'POST', body: { email: 'test@example.com', password: 'wrongpassword' } },
  { name: 'Auth Me (Unauthorized)', url: `${PRODUCTION_URL}/api/auth/me`, method: 'GET' }
];

function makeRequest(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Production-Test-Agent/1.0',
        'Accept': 'application/json, text/html, */*',
        'Origin': PRODUCTION_URL,
        'X-Automation': 'true',
        ...headers
      },
      timeout: 15000
    };

    if (body && method !== 'GET') {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(options, (res) => {
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
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body && method !== 'GET') {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runProductionTests() {
  console.log('🌐 Starting Production Endpoint Tests...\n');
  console.log(`Testing: ${PRODUCTION_URL}\n`);
  
  const results = [];
  
  for (const test of testEndpoints) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await makeRequest(test.url, test.method, {}, test.body);
      
      if (result.success || (test.name === 'Login Endpoint' && result.statusCode === 400) || (test.name === 'Auth Me (Unauthorized)' && result.statusCode === 401)) {
        console.log(`✅ ${test.name}: OK (${result.statusCode})`);
        
        // Check for CORS headers
        const corsHeaders = {
          'access-control-allow-origin': result.headers['access-control-allow-origin'],
          'access-control-allow-credentials': result.headers['access-control-allow-credentials'],
          'access-control-allow-methods': result.headers['access-control-allow-methods']
        };
        
        if (corsHeaders['access-control-allow-origin']) {
          console.log(`   CORS: Origin allowed - ${corsHeaders['access-control-allow-origin']}`);
        }
        
        // Check content type and parse response
        const contentType = result.headers['content-type'] || '';
        
        if (test.expectHtml && contentType.includes('text/html')) {
          console.log(`   HTML: Valid HTML response (${result.data.length} chars)`);
          if (result.data.includes('<div id="root">')) {
            console.log(`   React: React root element found`);
          }
        } else if (contentType.includes('application/json')) {
          try {
            const jsonData = JSON.parse(result.data);
            console.log(`   JSON: Valid response structure`);
            if (jsonData.success !== undefined) {
              console.log(`   Status: ${jsonData.success ? 'Success' : 'Failed'}`);
            }
            if (jsonData.status) {
              console.log(`   Health: ${jsonData.status}`);
            }
          } catch (e) {
            console.log(`   JSON: Invalid JSON response`);
          }
        }
        
        results.push({ test: test.name, status: 'PASS', statusCode: result.statusCode });
      } else {
        console.log(`❌ ${test.name}: FAILED (${result.statusCode})`);
        console.log(`   Response: ${result.data.substring(0, 200)}...`);
        results.push({ test: test.name, status: 'FAIL', statusCode: result.statusCode });
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      results.push({ test: test.name, status: 'ERROR', error: error.message });
    }
    console.log('');
  }
  
  // Summary
  console.log('📊 Production Test Summary:');
  console.log('============================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🚨 Errors: ${errors}`);
  
  if (failed === 0 && errors === 0) {
    console.log('\n🎉 All production tests passed! Server is fully operational.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the issues above.');
    process.exit(1);
  }
}

runProductionTests().catch(console.error);