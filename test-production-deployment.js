#!/usr/bin/env node

// Production deployment test script
const https = require('https');
const http = require('http');

const PRODUCTION_URL = 'https://123ad-performance.launchpulse.ai';

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
        'User-Agent': 'Mozilla/5.0 (HeadlessChrome/91.0.4472.124) Production-Test',
        'Accept': 'application/json, text/html, */*',
        'Origin': PRODUCTION_URL,
        'Referer': PRODUCTION_URL + '/',
        'X-Automation': 'true',
        ...headers
      },
      timeout: 30000,
      // Allow self-signed certificates for testing
      rejectUnauthorized: false
    };

    if (body) {
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

async function testProductionEndpoints() {
  console.log('🚀 Testing Production Deployment...\n');
  console.log(`Production URL: ${PRODUCTION_URL}\n`);
  
  const endpoints = [
    { name: 'Frontend Root', url: `${PRODUCTION_URL}/`, method: 'GET' },
    { name: 'Health Check', url: `${PRODUCTION_URL}/health`, method: 'GET' },
    { name: 'API Status', url: `${PRODUCTION_URL}/api/status`, method: 'GET' },
    { name: 'API Debug', url: `${PRODUCTION_URL}/api/debug`, method: 'GET' },
    { name: 'API Validation', url: `${PRODUCTION_URL}/api/test/validate`, method: 'GET' },
    { name: 'CORS Preflight', url: `${PRODUCTION_URL}/api/auth/login`, method: 'OPTIONS' }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const result = await makeRequest(endpoint.url, endpoint.method);
      
      if (result.success) {
        console.log(`✅ ${endpoint.name}: OK (${result.statusCode})`);
        
        // Check CORS headers
        const corsHeaders = {
          'access-control-allow-origin': result.headers['access-control-allow-origin'],
          'access-control-allow-credentials': result.headers['access-control-allow-credentials'],
          'access-control-allow-methods': result.headers['access-control-allow-methods']
        };
        
        if (corsHeaders['access-control-allow-origin']) {
          console.log(`   CORS: Origin allowed - ${corsHeaders['access-control-allow-origin']}`);
        }
        
        // Check JSON response
        if (result.headers['content-type']?.includes('application/json')) {
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
        } else if (result.headers['content-type']?.includes('text/html')) {
          console.log(`   HTML: Frontend served successfully`);
        }
        
        results.push({ endpoint: endpoint.name, status: 'PASS', statusCode: result.statusCode });
      } else {
        console.log(`❌ ${endpoint.name}: FAILED (${result.statusCode})`);
        console.log(`   Response: ${result.data.substring(0, 200)}`);
        results.push({ endpoint: endpoint.name, status: 'FAIL', statusCode: result.statusCode });
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
      results.push({ endpoint: endpoint.name, status: 'ERROR', error: error.message });
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
    console.log('\n🎉 All production tests passed! Deployment is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some production tests failed. Check deployment configuration.');
    
    // Provide troubleshooting suggestions
    console.log('\n🔧 Troubleshooting Suggestions:');
    console.log('1. Verify server is running and accessible');
    console.log('2. Check SSL certificate configuration');
    console.log('3. Verify DNS resolution for the domain');
    console.log('4. Check firewall and security group settings');
    console.log('5. Verify environment variables are set correctly');
    
    process.exit(1);
  }
}

async function testAuthenticationFlow() {
  console.log('🔐 Testing Production Authentication Flow...\n');
  
  try {
    // Test user registration
    console.log('1. Testing user registration...');
    const registerData = JSON.stringify({
      email: `prod-test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Production Test User'
    });
    
    const registerResult = await makeRequest(
      `${PRODUCTION_URL}/api/auth/register`,
      'POST',
      { 'Content-Type': 'application/json' },
      registerData
    );
    
    if (registerResult.success) {
      console.log('✅ Production user registration: SUCCESS');
      const userData = JSON.parse(registerResult.data);
      console.log(`   User ID: ${userData.user?.id}`);
      console.log(`   Token received: ${userData.token ? 'Yes' : 'No'}`);
      
      // Test authenticated request
      console.log('\n2. Testing authenticated request...');
      const authResult = await makeRequest(
        `${PRODUCTION_URL}/api/auth/me`,
        'GET',
        { 
          'Authorization': `Bearer ${userData.token}`,
          'Content-Type': 'application/json'
        }
      );
      
      if (authResult.success) {
        console.log('✅ Production authenticated request: SUCCESS');
        const authData = JSON.parse(authResult.data);
        console.log(`   Authenticated user: ${authData.email}`);
      } else {
        console.log(`❌ Production authenticated request: FAILED (${authResult.statusCode})`);
      }
      
    } else {
      console.log(`❌ Production user registration: FAILED (${registerResult.statusCode})`);
      console.log(`   Response: ${registerResult.data.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ Production authentication flow: ERROR - ${error.message}`);
  }
}

async function runProductionTests() {
  console.log('🌐 Production Deployment Validation');
  console.log('===================================\n');
  
  await testProductionEndpoints();
  await testAuthenticationFlow();
  
  console.log('\n✨ Production deployment testing completed!');
}

runProductionTests().catch(console.error);