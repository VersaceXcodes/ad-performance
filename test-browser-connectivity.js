#!/usr/bin/env node

// Simple browser testing script to validate connectivity
const http = require('http');
const https = require('https');

const testEndpoints = [
  { name: 'Frontend', url: 'http://localhost:5173', method: 'GET' },
  { name: 'Backend Health', url: 'http://localhost:3000/health', method: 'GET' },
  { name: 'API Status', url: 'http://localhost:3000/api/status', method: 'GET' },
  { name: 'API Debug', url: 'http://localhost:3000/api/debug', method: 'GET' },
  { name: 'API Validation', url: 'http://localhost:3000/api/test/validate', method: 'GET' }
];

function makeRequest(url, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Browser-Test-Agent/1.0',
        'Accept': 'application/json, text/html, */*',
        'Origin': 'http://localhost:5173',
        ...headers
      },
      timeout: 10000
    };

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
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Browser Connectivity Tests...\n');
  
  const results = [];
  
  for (const test of testEndpoints) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await makeRequest(test.url, test.method);
      
      if (result.success) {
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
        
        // Try to parse JSON response
        if (result.headers['content-type']?.includes('application/json')) {
          try {
            const jsonData = JSON.parse(result.data);
            console.log(`   JSON: Valid response structure`);
            if (jsonData.success !== undefined) {
              console.log(`   Status: ${jsonData.success ? 'Success' : 'Failed'}`);
            }
          } catch (e) {
            console.log(`   JSON: Invalid JSON response`);
          }
        }
        
        results.push({ test: test.name, status: 'PASS', statusCode: result.statusCode });
      } else {
        console.log(`❌ ${test.name}: FAILED (${result.statusCode})`);
        results.push({ test: test.name, status: 'FAIL', statusCode: result.statusCode });
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      results.push({ test: test.name, status: 'ERROR', error: error.message });
    }
    console.log('');
  }
  
  // Summary
  console.log('📊 Test Summary:');
  console.log('================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🚨 Errors: ${errors}`);
  
  if (failed === 0 && errors === 0) {
    console.log('\n🎉 All tests passed! Browser connectivity is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the issues above.');
    process.exit(1);
  }
}

runTests().catch(console.error);